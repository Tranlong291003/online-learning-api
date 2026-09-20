const { pool } = require("../../config/db.config");
const { sendServerError } = require("../../utils/errorResponse");
const { revokeAllForUser } = require("../../services/tokenService");

const updateUserStatus = async (req, res) => {
  const uid = req.params.id;
  const { status } = req.body;

  // Đã được chặn ở tầng route (authorize("admin")). Giữ lại làm lớp phòng thủ
  // thứ hai phòng khi route được mount lại mà quên middleware.
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Bạn không có quyền cập nhật trạng thái người dùng" });
  }

  if (!["active", "disabled"].includes(status)) {
    return res.status(400).json({ error: "Trạng thái không hợp lệ" });
  }

  const isActive = status === "active";

  try {
    const result = await pool.query(
      `UPDATE users
       SET is_active = $1, updated_at = NOW()
       WHERE uid = $2
       RETURNING uid`,
      [isActive, uid]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy người dùng" });
    }

    // Tự khoá tài khoản của chính mình sẽ chấm dứt luôn phiên đang thực hiện
    // thao tác. Chỉ chặn chiều "khoá"; tự mở khoá là vô hại.
    if (!isActive && String(uid) === String(req.user.uid)) {
      return res.status(400).json({ error: "Không thể tự khoá tài khoản của chính mình" });
    }

    // Khoá tài khoản phải chấm dứt các phiên đang mở, nếu không người bị khoá
    // vẫn dùng được refresh token để lấy access token mới và tiếp tục làm việc.
    // (authMiddleware đã chặn theo is_active, đây là lớp thứ hai cho gọn dữ liệu.)
    if (!isActive) {
      await revokeAllForUser(uid);
    }

    res.json({
      message: "Trạng thái người dùng đã được cập nhật thành công",
    });
  } catch (err) {
    console.error("Error in updateUserStatus:", err);

    sendServerError(res, "Lỗi khi cập nhật trạng thái người dùng", err);
  }
};

module.exports = updateUserStatus;
