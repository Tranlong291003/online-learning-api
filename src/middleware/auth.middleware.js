const jwt = require("jsonwebtoken");

// Danh sách blacklist token (demo, lưu trong RAM)
const blacklist = new Set([
  // Token bạn muốn vô hiệu hóa:
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiJENFBRTXdXOEo0VldvT2ZuMVJFOFlxSEFGMGsxIiwiZW1haWwiOiJhZG1AZ21haWwuY29tIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzQ3OTc3MzQ1LCJleHAiOjE3NDg1ODIxNDV9.wI2RcLPdxAkL52PxWwDETZMSfuIPMpRnFGv-7RVQubg",
]);

module.exports = (req, res, next) => {
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
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "your_secret_key"
    );
    req.user = decoded;
    next();
  } catch (err) {
    return res
      .status(401)
      .json({ error: "Token không hợp lệ hoặc đã hết hạn" });
  }
};
