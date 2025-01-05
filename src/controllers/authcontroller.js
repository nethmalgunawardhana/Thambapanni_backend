const { db, } = require('../config/firebase');

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

    const userRef = await db.collection('users').add({
      firstName,
      lastName,
      email,
      nationality,
      gender,
      dateOfBirth,
      password,
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

    if (userData.password !== password) {
      return res.status(401).json({ message: 'Invalid password' });
    }

    res.status(200).json({ message: 'Login successful', user: userData });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
