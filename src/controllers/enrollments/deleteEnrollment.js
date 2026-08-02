const { pool } = require("../../config/db.config");

const deleteEnrollment = async (req, res) => {
  try {
    const { enrollment_id } = req.params;

    const result = await pool.query(
      "DELETE FROM enrollments WHERE enrollment_id = $1 RETURNING enrollment_id",
      [enrollment_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "❌ Không tìm thấy đăng ký để huỷ" });
    }

    res.json({ message: "🗑️ Huỷ đăng ký thành công" });
  } catch (err) {
    res.status(500).json({ error: "Lỗi huỷ đăng ký: " + err.message });
  }
};

module.exports = deleteEnrollment;
