// config/firebase.config.js
const admin = require("firebase-admin");
const serviceAccount = require("../firebaseServiceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  // Tùy theo bạn có dùng DB nào của Firebase (Firestore, Realtime Database)
  // databaseURL: "https://<your-project>.firebaseio.com"
});

module.exports = admin;
