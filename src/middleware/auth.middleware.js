const jwt = require("jsonwebtoken");
const { getAuthStateForUid } = require("../services/authUserLookup");

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

// Cho phép tắt đối chiếu DB (dùng trong test đơn vị không mock được DB lookup).
const SKIP_DB_CHECK = process.env.AUTH_SKIP_DB_CHECK === "true";

module.exports = async (req, res, next) => {
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

  let decoded;
  try {
    if (!JWT_SECRET) {
      return res.status(500).json({ error: "Server chưa được cấu hình JWT_SECRET" });
    }
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return res
      .status(401)
      .json({ error: "Token không hợp lệ hoặc đã hết hạn" });
  }

  // Đối chiếu DB: role trong token có thể đã cũ (JWT hạn 7 ngày) và tài khoản có thể
  // đã bị khoá/xoá sau khi token được phát hành. Chỉ verify chữ ký là chưa đủ — quyền
  // bị thu hồi hoặc tài khoản bị khoá vẫn dùng được tới khi token hết hạn.
  if (!SKIP_DB_CHECK) {
    let state;
    try {
      state = await getAuthStateForUid(decoded.uid);
    } catch (err) {
      console.error("Lỗi tra cứu người dùng khi xác thực:", err.message);
      return res.status(503).json({ error: "Không kiểm tra được trạng thái người dùng" });
    }

    if (!state) {
      return res.status(401).json({ error: "Tài khoản không tồn tại" });
    }
    if (state.is_active === false) {
      return res.status(403).json({ error: "Tài khoản đã bị khoá" });
    }

    // Role lấy từ DB là nguồn chân lý, không phải từ token.
    decoded.role = state.role;
  }

  req.user = decoded;
  next();
};
