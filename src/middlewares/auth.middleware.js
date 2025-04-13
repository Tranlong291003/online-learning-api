// middlewares/checkAuth.js
const admin = require("../config/firebase.config");

async function checkAuth(req, res, next) {
  const authorizationHeader = req.headers.authorization || "";
  const token = authorizationHeader.split(" ")[1]; // Tách "Bearer <token>"

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken; // Gắn user đã xác thực vào req
    next(); // Cho phép request đi tiếp
  } catch (error) {
    console.error("Error verifying Firebase ID token:", error);
    return res.status(401).json({ error: "Unauthorized" });
  }
}

module.exports = checkAuth;
