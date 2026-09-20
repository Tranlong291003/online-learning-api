const { getAuthStateForUid } = require("../services/authUserLookup");
const { verifyAccessToken } = require("../services/tokenService");
const { isJwtSecretConfigured } = require("../config/auth.config");

// Dev API key - chỉ hoạt động khi được cấu hình rõ ràng và KHÔNG phải production
const DEV_API_KEY = process.env.DEV_API_KEY;
const DEV_KEY_ENABLED = !!DEV_API_KEY && process.env.NODE_ENV !== "production";

// Cho phép tắt đối chiếu DB (dùng trong test đơn vị không mock được DB lookup).
const SKIP_DB_CHECK = process.env.AUTH_SKIP_DB_CHECK === "true";

/**
 * Xác thực request và gắn `req.user`.
 *
 * Access token là JWT ngắn hạn (mặc định 15 phút), nhưng vẫn đối chiếu DB mỗi
 * request vì hai lý do:
 *  - role trong token có thể đã cũ (admin vừa bị hạ quyền vẫn giữ quyền admin);
 *  - tài khoản có thể đã bị khoá/xoá sau khi token được phát hành.
 * Chỉ verify chữ ký là chưa đủ.
 *
 * Việc đối chiếu này chỉ tốn một truy vấn theo khoá chính. Nếu sau này thành nút
 * cổ chai, chỗ cần sửa là `authUserLookup.getAuthStateForUid` (thêm cache), không
 * phải middleware này.
 */
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
  const token = authHeader.slice("Bearer ".length).trim();

  if (!token) {
    return res.status(401).json({ error: "Token không hợp lệ" });
  }

  let decoded;
  try {
    if (!isJwtSecretConfigured()) {
      return res.status(500).json({ error: "Server chưa được cấu hình JWT_SECRET" });
    }
    decoded = verifyAccessToken(token);
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      // Phân biệt rõ với token sai/hỏng để FE biết đường gọi /api/auth/refresh.
      return res.status(401).json({ error: "Token đã hết hạn", code: "TOKEN_EXPIRED" });
    }
    return res.status(401).json({ error: "Token không hợp lệ" });
  }

  if (!decoded.uid) {
    return res.status(401).json({ error: "Token không hợp lệ" });
  }

  if (!SKIP_DB_CHECK) {
    let state;
    try {
      state = await getAuthStateForUid(decoded.uid);
    } catch (error) {
      console.error("Lỗi tra cứu người dùng khi xác thực:", error.message);
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
