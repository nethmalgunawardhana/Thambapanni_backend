const admin = require('firebase-admin');
const serviceAccount = require('../../serviceAccountKey.json'); // Adjust path as needed

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log('Firebase Admin SDK initialized successfully');
}


const db = admin.firestore();

module.exports = { admin, db};


