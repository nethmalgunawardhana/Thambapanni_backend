const { db } = require('../config/firebase');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const sgMail = require('@sendgrid/mail')
let otpStorage = {}; // Temporary OTP storage (for production, use a database)
sgMail.setApiKey(process.env.SENDGRID_API_KEY)
// Send OTP to email
exports.sendOtp = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  try {
    const userSnapshot = await db.collection('users').where('email', '==', email).get();
    if (userSnapshot.empty) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Generate OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    otpStorage[email] = otp; // Store OTP temporarily

   /*  // Configure Nodemailer
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user:process.env.MAIL_NAME, // Your email
        pass: process.env.MAIL_PASSWORD, // Your email password or app-specific password
      },
    }); */

    const msg = {
      to: email, // Change to your recipient
      from: process.env.MAIL_NAME, // Change to your verified sender
      templateId: process.env.SENDGRID_TEMPLATE_ID, // Add your template ID here
      dynamicTemplateData: {
        otp: otp, // Pass the OTP as dynamic data
        subject: 'Your Password Reset OTP', // Additional dynamic fields if needed
      },
    }
    sgMail
  .send(msg)
  .then(() => {
    console.log('Email sent')
  })
  .catch((error) => {
    console.error(error)
  })

    /* // Send email 
    await transporter.sendMail({
      from: 'adithabuwaneka0@gmail.com',
      to: email,
      subject: 'Password Reset OTP',
      text: `Your OTP for password reset is ${otp}. This code will expire in 10 minutes.`,
    }); */

    res.status(200).json({ message: 'OTP sent successfully to your email.' });
  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).json({ message: 'Error sending OTP' });
  }
};



// Verify OTP
exports.verifyOtp = async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ message: 'Email and OTP are required' });
  }

  try {
    // Check if the OTP exists for the email
    if (!otpStorage[email] || otpStorage[email] !== otp) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    
    
    res.status(200).json({ message: 'OTP verified successfully' });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({ message: 'Error verifying OTP', error: error.message });
  }
};

// Verify OTP and reset password
exports.resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    return res.status(400).json({ message: 'Email, OTP, and new password are required' });
  }

  try {
    // Check OTP
    if (otpStorage[email] !== otp) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    const userSnapshot = await db.collection('users').where('email', '==', email).get();
    if (userSnapshot.empty) {
      return res.status(404).json({ message: 'User not found' });
    }

    const userId = userSnapshot.docs[0].id;

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update the password in Firestore
    await db.collection('users').doc(userId).update({
      password: hashedPassword,
    });

    // Clear OTP after use
    delete otpStorage[email];

    res.status(200).json({ message: 'Password reset successfully.' });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ message: 'Error resetting password' });
  }
};
