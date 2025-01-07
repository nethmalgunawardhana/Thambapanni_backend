// Import necessary modules
const { db } = require('../config/firebase');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const sgMail = require('@sendgrid/mail');

// Set SendGrid API key
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

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

    // Generate OTP and expiration time
    const otp = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // OTP valid for 10 minutes

    // Save OTP to Firestore
    await db.collection('otp').doc(email).set({
      otp,
      email,
      expiresAt,
    });

    // Configure SendGrid email
    const msg = {
      to: email,
      from: process.env.MAIL_NAME, // Your verified sender
      templateId: process.env.SENDGRID_TEMPLATE_ID, // Your SendGrid template ID
      dynamicTemplateData: {
        otp,
        subject: 'Your Password Reset OTP',
      },
    };

    // Send email
    await sgMail.send(msg);

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
    const otpDoc = await db.collection('otp').doc(email).get();

    if (!otpDoc.exists) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    const { otp: storedOtp, expiresAt } = otpDoc.data();

    // Check if OTP is expired
    if (new Date() > expiresAt.toDate()) {
      await db.collection('otp').doc(email).delete(); // Clean up expired OTP
      return res.status(400).json({ message: 'OTP has expired' });
    }

    if (storedOtp !== otp) {
      return res.status(400).json({ message: 'Invalid OTP' });
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
    const otpDoc = await db.collection('otp').doc(email).get();

    if (!otpDoc.exists) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    const { otp: storedOtp, expiresAt } = otpDoc.data();

    // Check if OTP is expired
    if (new Date() > expiresAt.toDate()) {
      await db.collection('otp').doc(email).delete(); // Clean up expired OTP
      return res.status(400).json({ message: 'OTP has expired' });
    }

    if (storedOtp !== otp) {
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

    // Clean up OTP after successful password reset
    await db.collection('otp').doc(email).delete();

    res.status(200).json({ message: 'Password reset successfully.' });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ message: 'Error resetting password' });
  }
};
