const { sql, poolConnect, pool } = require("../../config/db.config");

const deleteEnrollment = async (req, res) => {
  try {
    const { enrollment_id } = req.params; // Sử dụng `enrollment_id` thay vì `id` để tránh nhầm lẫn
    await poolConnect; // Đảm bảo kết nối đã được thiết lập
    const request = new sql.Request(pool);
    request.input("enrollment_id", sql.Int, enrollment_id);

    const result = await request.query(
      "DELETE FROM enrollments WHERE enrollment_id = @enrollment_id"
    );

    if (result.rowsAffected[0] === 0) {
      return res
        .status(404)
        .json({ error: "❌ Không tìm thấy đăng ký để huỷ" });
    }

    res.json({ message: "🗑️ Huỷ đăng ký thành công" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
module.exports = deleteEnrollment;
