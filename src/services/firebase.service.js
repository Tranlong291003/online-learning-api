// services/firebase.service.js
// Lazy-loaded FCM messaging wrapper. Tra ve null neu khong co service account key
// de khong crash khi dev local khong setup FCM.
let messaging = null;
let initialized = false;

function init() {
  if (initialized) return messaging;
  initialized = true;
  try {
    const admin = require("firebase-admin");
    const path = require("path");
    const fs = require("fs");
    const keyPath = path.resolve(__dirname, "..", "firebaseServiceAccountKey.json");
    if (!fs.existsSync(keyPath)) {
      console.warn("[firebase.service] Khong tim thay firebaseServiceAccountKey.json -> FCM se bi disable");
      return null;
    }
    if (!admin.apps.length) {
      const serviceAccount = require(keyPath);
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    }
    messaging = admin.messaging();
    return messaging;
  } catch (e) {
    console.warn("[firebase.service] init failed:", e.message);
    return null;
  }
}

function getMessaging() {
  return init();
}

module.exports = { getMessaging };
