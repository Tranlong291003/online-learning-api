const admin = require("../config/firebase.config"); // Firebase Admin SDK

// Middleware xác thực idToken
const authenticateToken = async (req, res, next) => {
  // Lấy token từ header Authorization
  const token = req.headers["authorization"]?.split("Bearer ")[1];

  if (!token) {
    return res.status(403).json({ error: "Token không được cung cấp" });
  }

  try {
    // Xác thực token với Firebase Admin SDK
    const decodedToken = await admin.auth().verifyIdToken(token);

    // Lưu thông tin người dùng vào request để sử dụng ở các route tiếp theo
    req.user = decodedToken;
    next(); // Chuyển đến route tiếp theo
  } catch (err) {
    // Nếu không xác thực được token
    return res.status(401).json({ error: "Token không hợp lệ hoặc hết hạn" });
  }
};

module.exports = authenticateToken;
