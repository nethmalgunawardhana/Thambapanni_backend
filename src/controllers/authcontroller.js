const { db } = require('../config/firebase');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const SECRET_KEY = process.env.SECRET_KEY; // Replace with an environment variable in production

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

    const hashedPassword = await bcrypt.hash(password, 10); // Hash the password

    const userRef = await db.collection('users').add({
      firstName,
      lastName,
      email,
      nationality,
      gender,
      dateOfBirth,
      password: hashedPassword,
      createdAt: new Date().toISOString(),
    });

    res.status(200).json({ message: 'Account created successfully!', userId: userRef.id });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ message: 'Error registering user', error: error.message });
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
    const isPasswordValid = await bcrypt.compare(password, userData.password); // Compare hashed passwords

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid password' });
    }

    // Generate a JWT
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
