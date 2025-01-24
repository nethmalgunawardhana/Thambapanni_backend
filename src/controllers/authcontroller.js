const { db } = require('../config/firebase');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const sgMail = require('@sendgrid/mail');
const path = require('path');

const SECRET_KEY = process.env.SECRET_KEY;
const SENDGRID_TEMPLATE_ID = process.env.SENDGRID_TEMPLATE_ID_2;
const MAIL_NAME = process.env.MAIL_NAME;

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Handle user registration
exports.registerUser = async (req, res) => {
  const { firstName, lastName, email, nationality, gender, dateOfBirth, password } = req.body;

  if (!firstName || !lastName || !email || !nationality || !gender || !dateOfBirth || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const existingUserSnapshot = await db.collection('users').where('email', '==', email).get();
    if (!existingUserSnapshot.empty) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = jwt.sign({ email }, SECRET_KEY, { expiresIn: '1m' });

    const userRef = await db.collection('users').add({
      firstName,
      lastName,
      email,
      nationality,
      gender,
      dateOfBirth,
      password: hashedPassword,
      isVerified: false,
      createdAt: new Date().toISOString(),
    });

    const verificationUrl = `${req.protocol}://${req.get('host')}/auth/verify-email?token=${verificationToken}`;

    const msg = {
      to: email,
      from: MAIL_NAME,
      templateId: SENDGRID_TEMPLATE_ID,
      dynamicTemplateData: {
        firstName,
        verificationUrl,
        expiration: '1 minute',
      },
    };

    await sgMail.send(msg);

    res.status(200).json({
      message: 'Account created successfully! Please verify your email to log in.',
      userId: userRef.id,
    });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ message: 'Error registering user', error: error.message });
  }
};

// Verify email
exports.verifyEmail = async (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ message: 'Verification token is required' });
  }

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    const { email } = decoded;

    const userSnapshot = await db.collection('users').where('email', '==', email).get();
    if (userSnapshot.empty) {
      return res.status(404).json({ message: 'User not found' });
    }

    const userId = userSnapshot.docs[0].id;
    await db.collection('users').doc(userId).update({ isVerified: true });

    res.sendFile(path.join(__dirname, '../../public/email-verification-success.html'));
  } catch (error) {
    console.error('Error verifying email:', error);

    if (error.name === 'TokenExpiredError') {
      const decoded = jwt.decode(token); // Decode the token to get the email
      const { email } = decoded;

      const userSnapshot = await db.collection('users').where('email', '==', email).get();
      if (!userSnapshot.empty) {
        const userId = userSnapshot.docs[0].id;
        const user = userSnapshot.docs[0].data(); // Extract user data

        // Check if the user's `isVerified` field is false
        if (!user.isVerified) {
          await db.collection('users').doc(userId).delete();
        }
      }

      return res.sendFile(path.join(__dirname, '../../public/email-verification-failure.html'));
    }

    res.status(400).json({ message: 'Invalid token or an unknown error occurred.' });
  }
};


// Handle user login
exports.loginUser = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    const userSnapshot = await db.collection('users').where('email', '==', email).get();

    if (userSnapshot.empty) {
      return res.status(404).json({ message: 'User not found' });
    }

    const userData = userSnapshot.docs[0].data();

    if (!userData.isVerified) {
      return res.status(403).json({ message: 'Please verify your email before logging in.' });
    }

    const isPasswordValid = await bcrypt.compare(password, userData.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid password' });
    }

    const token = jwt.sign(
      { email: userData.email, userId: userSnapshot.docs[0].id },
      SECRET_KEY,
      { expiresIn: '1h' }
    );

    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        firstName: userData.firstName,
        lastName: userData.lastName,
        email: userData.email,
      },
    });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
