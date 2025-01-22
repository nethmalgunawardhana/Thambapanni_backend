const { db } = require('../config/firebase');
const sgMail = require('@sendgrid/mail');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

// SendGrid setup
sgMail.setApiKey(process.env.SENDGRID_API_KEY);
const SENDGRID_TEMPLATE_ID = process.env.SENDGRID_TEMPLATE_ID_3;
// Secret key for JWT
const SECRET_KEY = process.env.SECRET_KEY;

// Multer setup for handling file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = path.join(__dirname, '../../uploads');
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      cb(null, `${Date.now()}-${file.originalname}`);
    },
  }),
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('Only PDF files are allowed!'));
    }
    cb(null, true);
  },
  limits: { fileSize: 4.0 * 1024 * 1024 }, // 5MB file size limit
}).single('license');

// Admin Verify or Reject Application
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

    // Check if the token has expired
    const createdAt = new Date(guideData.createdAt).getTime();
    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;

    if (now - createdAt > sevenDays) {
      await guideRef.update({ isVerified: false, status: 'expired' });
      return res.status(400).json({ success: false, message: 'Verification token has expired.' });
    }

    if (action === 'verify') {
      // Update Firestore to mark the application as verified
      await guideRef.update({ isVerified: true, status: 'verified' });
      res.status(200).send('Application has been verified successfully!');
    } else if (action === 'reject') {
      // Update Firestore to mark the application as rejected
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

// Submit Guide Application with Verification and Rejection Links
exports.submitGuideApplication = (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      console.error('File upload error:', err);
      return res.status(400).json({ success: false, message: err.message });
    }

    const { fullName, email, phone, languages, location, experience } = req.body;

    if (!fullName || !email || !phone || !languages || !location || !req.file) {
      if (req.file && req.file.path) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({
        success: false,
        message: 'Full name, email, phone, location, languages, and license file are required.',
      });
    }

    try {
      const guideRef = db.collection('guides').doc();
      const licenseUri = `/uploads/${req.file.filename}`;

      await guideRef.set({
        fullName,
        email,
        phone,
        languages,
        location,
        experience: experience || '',
        licenseUri,
        isVerified: false,
        status: 'pending',
        createdAt: new Date().toISOString(),
      });

      const verificationToken = jwt.sign({ id: guideRef.id }, SECRET_KEY, {
        expiresIn: '7d',
      });

      const verificationUrl = `${req.protocol}://${req.get('host')}/guides/admin-verify?token=${verificationToken}&action=verify`;
      const rejectionUrl = `${req.protocol}://${req.get('host')}/guides/admin-verify?token=${verificationToken}&action=reject`;

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
          experience: experience || 'N/A',
          verificationUrl,
          rejectionUrl,
        },
        attachments: [
          {
            content: fs.readFileSync(path.join(__dirname, `../../uploads/${req.file.filename}`)).toString('base64'),
            filename: req.file.filename,
            type: 'application/pdf',
            disposition: 'attachment',
          },
        ],
      };
      
      await sgMail.send(msg);
      

      res.status(200).json({
        success: true,
        message: 'Guide application submitted successfully! The admin will review it shortly.',
        guideId: guideRef.id,
      });
    } catch (error) {
      console.error('Error submitting guide application:', error);
      if (req.file && req.file.path) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({
        success: false,
        message: 'Failed to submit guide application.',
        error: error.message,
      });
    }
  });
};

// Get Application Status
exports.getApplicationStatus = async (req, res) => {
 
  const email = req.user.email;
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


