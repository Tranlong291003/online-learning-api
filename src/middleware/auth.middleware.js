const jwt = require("jsonwebtoken");

// Token blacklist - nên lưu trong Redis/DB cho production
const blacklist = new Set();

// Validate JWT_SECRET tồn tại
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.warn("⚠️ JWT_SECRET chưa được set trong environment variables!");
}

// Dev API key - chỉ hoạt động khi được cấu hình rõ ràng và KHÔNG phải production
const DEV_API_KEY = process.env.DEV_API_KEY;
const DEV_KEY_ENABLED = !!DEV_API_KEY && process.env.NODE_ENV !== "production";

module.exports = (req, res, next) => {
  // Bypass JWT bằng dev key (dùng cho môi trường dev test nhanh)
  // Chấp nhận cả header "x-dev-api-key" lẫn "Authorization: Bearer <key>"
  if (DEV_KEY_ENABLED) {
    const devKey =
      req.headers["x-dev-api-key"] ||
      (req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
        ? req.headers.authorization.split(" ")[1]
        : "");
    if (devKey === DEV_API_KEY) {
      req.user = {
        uid: process.env.DEV_API_KEY_UID || "dev-admin",
        email: process.env.DEV_API_KEY_EMAIL || "dev@example.com",
        role: process.env.DEV_API_KEY_ROLE || "admin",
      };
      return next();
    }
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token không hợp lệ" });
  }
  const token = authHeader.split(" ")[1];

  // Kiểm tra blacklist
  if (blacklist.has(token)) {
    return res.status(401).json({ error: "Token đã bị thu hồi" });
  }

  try {
    if (!JWT_SECRET) {
      return res.status(500).json({ error: "Server chưa được cấu hình JWT_SECRET" });
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res
      .status(401)
      .json({ error: "Token không hợp lệ hoặc đã hết hạn" });
  }
};
