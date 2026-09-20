const { pool } = require("../../config/db.config");

const deleteUser = async (req, res) => {
  const { id } = req.params;

  // Đã được chặn ở tầng route (authorize("admin")). Giữ lại làm lớp phòng thủ
  // thứ hai phòng khi route được mount lại mà quên middleware.
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Bạn không có quyền xoá người dùng" });
  }

  // Xoá chính mình sẽ chấm dứt luôn phiên đang dùng để thực hiện thao tác này.
  if (String(id) === String(req.user.uid)) {
    return res.status(400).json({ error: "Không thể xoá tài khoản của chính mình" });
  }

  try {
    // Xoá user trong DB. Tài khoản đăng nhập giờ do chính API quản lý
    // (users.password_hash) nên không còn bước đồng bộ sang Firebase, và xoá
    // dòng này là chấm dứt mọi khả năng đăng nhập. refresh_tokens và
    // password_resets tự xoá theo nhờ ON DELETE CASCADE.
    const result = await pool.query(
      "DELETE FROM users WHERE uid = $1 RETURNING uid",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy người dùng" });
    }

    res.json({ message: "Đã xóa người dùng thành công" });
  } catch (err) {
    console.error("Error in deleteUser:", err);
    if (err.code === "23503") {
      return res
        .status(409)
        .json({ error: "Không thể xoá người dùng do còn dữ liệu liên quan" });
    }
    res.status(500).json({ error: "Lỗi khi xóa người dùng: " + err.message });
  }
};

module.exports = deleteUser;
