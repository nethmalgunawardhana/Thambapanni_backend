require('dotenv').config();

const { db } = require('../config/firebase');
const sgMail = require('@sendgrid/mail');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const ImageKit = require('imagekit');

// SendGrid setup
sgMail.setApiKey(process.env.SENDGRID_API_KEY);
const SENDGRID_TEMPLATE_ID = process.env.SENDGRID_TEMPLATE_ID_3;
const SECRET_KEY = process.env.SECRET_KEY;

const GUIDE_CONFIRMATION_TEMPLATE_ID = process.env.SENDGRID_TEMPLATE_ID_GUIDE_CONFIRMATION;
const USER_NOTIFICATION_TEMPLATE_ID_1 = process.env.SENDGRID_TEMPLATE_ID_USER_NOTIFICATION_1;
const USER_NOTIFICATION_TEMPLATE_ID_2 = process.env.SENDGRID_TEMPLATE_ID_USER_NOTIFICATION_2;

// ImageKit setup
const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});



// Multer setup for handling file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('Only PDF files are allowed!'));
    }
    cb(null, true);
  },
  limits: {
    fileSize: 2 * 1024 * 1024, // 4.5MB file size limit
  },
}).single('license');

const uploadToImageKit = async (fileBuffer, fileName) => {
  try {
    const result = await imagekit.upload({
      file: fileBuffer,
      fileName: `${Date.now()}-${fileName}`,
      folder: '/guide-licenses',
      useUniqueFileName: true,
    });
    return result;
  } catch (error) {
    throw new Error(`ImageKit upload failed: ${error.message}`);
  }
};

exports.submitGuideApplication = (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      console.error('File upload error:', err);
      return res.status(400).json({ success: false, message: err.message });
    }

    const { fullName, email, phone, languages, location, experience } = req.body;

    if (!fullName || !email || !phone || !languages || !location || !req.file) {
      return res.status(400).json({
        success: false,
        message: 'All fields including the license file are required.',
      });
    }

    try {
      const imageKitResponse = await uploadToImageKit(req.file.buffer, req.file.originalname);
      const guideRef = db.collection('guides').doc();

      await guideRef.set({
        id: guideRef.id, // Add the auto-generated Firestore document ID
        fullName,
        email,
        phone,
        languages,
        location,
        experience: experience || '',
        licenseUri: imageKitResponse.url,
        fileId: imageKitResponse.fileId,
        isVerified: false,
        status: 'pending',
        pricePerKm: 0.5, 
        createdAt: new Date().toISOString(),
      });

      const verificationToken = jwt.sign({ id: guideRef.id }, SECRET_KEY, { expiresIn: '7d' });

      const verificationUrl = `${req.protocol}://${req.get('host')}/guides/admin-verify?token=${verificationToken}&action=verify`;
      const rejectionUrl = `${req.protocol}://${req.get('host')}/guides/admin-verify?token=${verificationToken}&action=reject`;
      const licenseUrl = imageKitResponse.url;

      const msg = {
        to: process.env.ADMIN_EMAIL,
        from: process.env.MAIL_NAME,
        templateId: SENDGRID_TEMPLATE_ID,
        dynamicTemplateData: {
          fullName,
          email,
          phone,
          languages,
          location,
          experience,
          verificationUrl,
          rejectionUrl,
          licenseUrl,
        },
      };

      await sgMail.send(msg);

      res.status(200).json({
        success: true,
        message: 'Guide application submitted successfully! The admin will review it shortly.',
        guideId: guideRef.id,
      });
    } catch (error) {
      console.error('Error submitting guide application:', error);
      res.status(500).json({ success: false, message: 'Failed to submit guide application.', error: error.message });
    }
  });
};

exports.adminVerifyApplication = async (req, res) => {
  const { token, action } = req.query;

  if (!token) {
    return res.status(400).json({ success: false, message: 'Verification token is required.' });
  }

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    const { id } = decoded;

    const guideRef = db.collection('guides').doc(id);
    const guideDoc = await guideRef.get();

    if (!guideDoc.exists) {
      return res.status(404).json({ success: false, message: 'Guide application not found.' });
    }

    const guideData = guideDoc.data();

    const createdAt = new Date(guideData.createdAt).getTime();
    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;

    if (now - createdAt > sevenDays) {
      await guideRef.update({ isVerified: false, status: 'expired' });
      return res.status(400).json({ success: false, message: 'Verification token has expired.' });
    }

    if (action === 'verify') {
      await guideRef.update({ isVerified: true, status: 'verified' });
      res.status(200).send('Application has been verified successfully!');
    } else if (action === 'reject') {
      await guideRef.update({ isVerified: false, status: 'rejected' });
      res.status(200).send('Application has been rejected successfully!');
    } else {
      res.status(400).json({ success: false, message: 'Invalid action.' });
    }
  } catch (error) {
    console.error('Error verifying or rejecting guide application:', error);
    res.status(400).json({ success: false, message: 'Invalid or expired token.' });
  }
};

exports.getApplicationStatus = async (req, res) => {
  const email = req.user?.email;

  if (!email) {
    return res.status(400).json({ success: false, message: 'Email is required.' });
  }

  try {
    const guideRef = db.collection('guides').where('email', '==', email);
    const snapshot = await guideRef.get();

    if (snapshot.empty) {
      return res.status(404).json({ success: false, message: 'No application found.' });
    }

    const guideData = snapshot.docs[0].data();
    const { isVerified, status } = guideData;

    let message = 'Pending verification.';
    if (status === 'rejected') message = 'Your application is rejected. Please try again.';
    if (status === 'expired') message = 'Your application is not verified. Please try again.';
    if (isVerified) message = 'You are an official guide for the Thambapanni team.';

    res.status(200).json({ success: true, status, message });
  } catch (error) {
    console.error('Error fetching application status:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch application status.' });
  }
};

exports.deleteLicensePDF = async (fileId) => {
  try {
    await imagekit.deleteFile(fileId);
    return true;
  } catch (error) {
    console.error('Error deleting file from ImageKit:', error);
    return false;
  }
};


exports.getVerifiedGuides = async (req, res) => {
  try {
    // Query Firestore for guides who are verified
    const guidesRef = db.collection('guides').where('isVerified', '==', true);
    const snapshot = await guidesRef.get();

    if (snapshot.empty) {
      return res.status(404).json({ success: false, message: 'No verified guides found.' });
    }

    // Map the guides to return only the required fields
    const verifiedGuides = snapshot.docs.map(doc => {
      const guide = doc.data();
      return {
        id: guide.id,
        fullName: guide.fullName,
        email: guide.email,
        phone: guide.phone,
        languages: guide.languages,
        location: guide.location,
        pricePerKm: guide.pricePerKm,
        trips: guide.trips
      };
    });

    res.status(200).json({
      success: true,
      data: verifiedGuides
    });
  } catch (error) {
    console.error('Error fetching verified guides:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch verified guides.' });
  }
};

// tripFormatter.js
const formatTripDetails = (tripData) => {
  if (!tripData || typeof tripData !== 'object') {
    return 'Trip details not available';
  }

  const formatCurrency = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Format daily itinerary
  const formatDayActivities = (activities) => {
    if (!Array.isArray(activities)) return '';
    return activities
      .map(activity => {
        if (!activity.time || !activity.description || !activity.destination) return '';
        return `
          <div class="activity-item">
            <span class="activity-time">${activity.time}</span>
            <span class="activity-desc">${activity.description}</span>
            <span class="activity-dest">${activity.destination}</span>
          </div>`;
      })
      .join('');
  };

  const dayDetailsHTML = tripData.days.map((day, index) => `
    <div class="day-container">
      <h3>Day ${index + 1} - ${formatDate(day.date)}</h3>
      <div class="day-details">
        <p><strong>Transportation:</strong> ${day.transportation}</p>
        <p><strong>Accommodation:</strong> ${day.accommodation || 'Not specified'}</p>
        <div class="activities-container">
          <p><strong>Activities:</strong></p>
          ${formatDayActivities(day.activities)}
        </div>
      </div>
    </div>
  `).join('');

  return `
    <div class="trip-summary">
      <h2>Trip Overview</h2>
      <ul>
        <li><strong>Trip ID:</strong> ${tripData.tripId}</li>
        <li><strong>Title:</strong> ${tripData.tripTitle}</li>
        <li><strong>Duration:</strong> ${tripData.days.length} days</li>
        <li><strong>Number of Travelers:</strong> ${tripData.searchParams.members}</li>
        <li><strong>Budget Range:</strong> ${tripData.searchParams.budgetRange}</li>
        <li><strong>Total Distance:</strong> ${Math.round(tripData.distanceInfo.totalDistanceKm)} km</li>
      </ul>
    </div>
    <div class="itinerary-section">
      <h2>Detailed Itinerary</h2>
      ${dayDetailsHTML}
    </div>`;
};

// guideController.js
exports.confirmGuideRequest = async (req, res) => {
  try {
    const { tripId, guideId, tripDetails, guidePrice, token } = req.body;

    // Validate the request
    if (!tripId || !guideId || !token) {
      console.error('Missing required fields:', { tripId, guideId, token });
      return res.status(400).json({ success: false, message: 'Missing required fields.' });
    }

    // Save the confirmation request to Firestore
    const confirmationRef = db.collection('guideConfirmations').doc();
    await confirmationRef.set({
      tripId,
      guideId,
      userId: req.user.userId,
      status: 'pending',
      guidePrice,
      createdAt: new Date().toISOString(),
      tripDetails,
    });

    // Get guide information
    const guideDoc = await db.collection('guides').doc(guideId).get();
    if (!guideDoc.exists) {
      return res.status(404).json({ success: false, message: 'Guide not found.' });
    }
    const guideData = guideDoc.data();

    // Generate confirmation token
    const confirmationToken = jwt.sign(
      { confirmationId: confirmationRef.id },
      process.env.SECRET_KEY,
      { expiresIn: '24h' }
    );

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const confirmUrl = `${baseUrl}/guides/guide-response?token=${confirmationToken}&action=confirm`;
    const rejectUrl = `${baseUrl}/guides/guide-response?token=${confirmationToken}&action=reject`;

    // Format trip details
    const formattedTripDetails = formatTripDetails(tripDetails);

    // Send email to guide
    const msg = {
      to: guideData.email,
      from: process.env.MAIL_NAME,
      templateId: GUIDE_CONFIRMATION_TEMPLATE_ID,
      dynamicTemplateData: {
        guideName: guideData.fullName,
        tripDetails: formattedTripDetails,
        guidePrice: `$${guidePrice.toFixed(2)}`,
        confirmUrl,
        rejectUrl,
      },
    };

    await sgMail.send(msg);
    res.status(200).json({ success: true, message: 'Guide confirmation request sent successfully.' });
  } catch (error) {
    console.error('Error confirming guide:', error);
    res.status(500).json({ success: false, message: 'Failed to confirm guide.' });
  }
};
exports.handleGuideResponse = async (req, res) => {
  const { token, action } = req.query;

  try {
      const decoded = jwt.verify(token, SECRET_KEY);
      const { confirmationId } = decoded;

      const confirmationRef = db.collection('guideConfirmations').doc(confirmationId);
      const confirmationDoc = await confirmationRef.get();

      if (!confirmationDoc.exists) {
          return res.status(404).json({
              success: false,
              message: 'Confirmation request not found'
          });
      }

      const confirmationData = confirmationDoc.data();

      // Get user and guide information
      const userDoc = await db.collection('users').doc(confirmationData.userId).get();
      const guideDoc = await db.collection('guides').doc(confirmationData.guideId).get();

      const userData = userDoc.data();
      const guideData = guideDoc.data();

      if (action === 'confirm') {
          await confirmationRef.update({
              status: 'confirmed',
              respondedAt: new Date().toISOString()
          });

          // Send confirmation email to user
          const userMsg = {
              to: userData.email,
              from: process.env.MAIL_NAME,
              templateId: USER_NOTIFICATION_TEMPLATE_ID_1,
              dynamicTemplateData: {
                  userName: userData.displayName,
                  guideName: guideData.fullName,
                  status: 'confirmed',
                  message: 'Your guide has confirmed the trip request. You can now proceed with the payment.'
              }
          };

          await sgMail.send(userMsg);
          res.send('You have successfully confirmed the guide request.');

      } else if (action === 'reject') {
          await confirmationRef.update({
              status: 'rejected',
              respondedAt: new Date().toISOString()
          });

          // Send rejection email to user
          const userMsg = {
              to: userData.email,
              from: process.env.MAIL_NAME,
              templateId: USER_NOTIFICATION_TEMPLATE_ID_2,
              dynamicTemplateData: {
                  userName: userData.displayName,
                  guideName: guideData.fullName,
                  status: 'rejected',
                  message: 'Unfortunately, your guide has rejected the trip request. Please try selecting another guide.'
              }
          };

          await sgMail.send(userMsg);
          res.send('You have rejected the guide request.');
      }

  } catch (error) {
      console.error('Error handling guide response:', error);
      res.status(500).json({
          success: false,
          message: 'Failed to process guide response'
      });
  }
};

exports.getGuideConfirmationStatus = async (req, res) => {
  const { tripId } = req.params;
  console.log('Fetching confirmation status for tripId:', tripId);

  try {
    const confirmationsRef = db.collection('guideConfirmations')
      .where('tripId', '==', tripId)
      .orderBy('createdAt', 'desc')
      .limit(1);

    const snapshot = await confirmationsRef.get();
   

    if (snapshot.empty) {
      console.log('No confirmation request found for tripId:', tripId);
      return res.status(404).json({
        success: false,
        message: 'No confirmation request found for this trip.'
      });
    }

    const confirmationData = snapshot.docs[0].data();
    const { status } = confirmationData;

    // Define a user-friendly message based on the status
    let message = 'Confirmation status is pending.';
    if (status === 'confirmed') message = 'The guide has confirmed the trip.';
    if (status === 'rejected') message = 'The guide has rejected the trip.';
    if (status === 'expired') message = 'The confirmation request has expired.';

    res.status(200).json({
      success: true,
      status,
      message,
      updatedAt: confirmationData.respondedAt || confirmationData.createdAt
    });

  } catch (error) {
    console.error('Error fetching guide confirmation status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch guide confirmation status.'
    });
  }
};