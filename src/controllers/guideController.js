const { db } = require('../config/firebase');
const sgMail = require('@sendgrid/mail');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const ImageKit = require('imagekit');

// SendGrid setup
sgMail.setApiKey(process.env.SENDGRID_API_KEY);
const SENDGRID_TEMPLATE_ID = process.env.SENDGRID_TEMPLATE_ID;
const SECRET_KEY = process.env.SECRET_KEY;

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
    fileSize: 4.5 * 1024 * 1024, // 4.5MB file size limit
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
