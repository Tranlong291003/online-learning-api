const { pool } = require("../../config/db.config");
const { sendServerError } = require("../../utils/errorResponse");
const { VALID_ROLES } = require("../../config/auth.config");
const { revokeAllForUser } = require("../../services/tokenService");

const updateRole = async (req, res) => {
  const { uid, role } = req.body;

  // Đã được chặn ở tầng route (authorize("admin")). Giữ lại làm lớp phòng thủ
  // thứ hai phòng khi route được mount lại mà quên middleware.
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Bạn không có quyền thay đổi vai trò" });
  }

  if (!uid || !role) {
    return res.status(400).json({ error: "Thiếu uid hoặc role" });
  }

  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: "Role không hợp lệ" });
  }

  // Tự hạ quyền admin của chính mình sẽ khiến không còn ai quản trị được hệ
  // thống. Chặn ở đây thay vì để phát hiện ra khi đã quá muộn.
  if (String(uid) === String(req.user.uid) && role !== "admin") {
    return res
      .status(400)
      .json({ error: "Không thể tự hạ quyền admin của chính mình" });
  }

  try {
    const result = await pool.query(
      "UPDATE users SET role = $1, updated_at = NOW() WHERE uid = $2 RETURNING uid",
      [role, uid]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy người dùng" });
    }

    // Access token cũ vẫn mang role cũ và sống tới 15 phút; thu hồi refresh token
    // buộc phiên làm mới lại và nhận đúng role mới. Middleware vẫn đối chiếu role
    // theo DB mỗi request nên quyền cũ mất hiệu lực ngay, không cần chờ hết hạn.
    await revokeAllForUser(uid);

    res.json({
      success: true,
      message: `Đã cập nhật role thành ${role}`,
    });
  } catch (err) {
    console.error("Error in updateRole:", err);
    sendServerError(res, "Lỗi khi cập nhật role", err);
  }
};

module.exports = updateRole;
