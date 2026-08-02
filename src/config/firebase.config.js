const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

function loadServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    return JSON.parse(
      Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, "base64").toString("utf8")
    );
  }

  const configuredPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  const defaultPath = path.join(__dirname, "..", "firebaseServiceAccountKey.json");
  const serviceAccountPath = configuredPath || defaultPath;

  if (fs.existsSync(serviceAccountPath)) {
    return require(serviceAccountPath);
  }

  return null;
}

if (admin.apps.length === 0) {
  const serviceAccount = loadServiceAccount();

  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else {
    console.warn(
      "Firebase service account is not configured. Firebase-backed endpoints require credentials."
    );
    admin.initializeApp();
  }
}

module.exports = admin;
