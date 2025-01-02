import * as admin from 'firebase-admin';


const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json'); // Download this from Firebase Console

if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }
// Export Firebase services
const auth = admin.auth();
const db = admin.firestore();

// Create timestamps
const timestamp = admin.firestore.FieldValue.serverTimestamp();
const timestampFromDate = admin.firestore.Timestamp.fromDate;

module.exports = { auth, db, timestamp, timestampFromDate };
