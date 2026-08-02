const { pool } = require("../../config/db.config");
const admin = require("../../config/firebase.config");

const deleteUser = async (req, res) => {
  const { id } = req.params;

  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Bạn không có quyền xoá người dùng" });
  }

  try {
    // Xóa trong PostgreSQL
    const result = await pool.query(
      "DELETE FROM users WHERE uid = $1 RETURNING uid",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy người dùng" });
    }

    // Xóa trong Firebase
    await admin.auth().deleteUser(id);

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
