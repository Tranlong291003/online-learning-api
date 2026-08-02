const { pool } = require("../../config/db.config");

const checkEnrollStatus = async (req, res) => {
  const { uid, course_id } = req.params;

  if (!uid || !course_id) {
    return res.status(400).json({ error: "Thiếu uid hoặc course_id" });
  }

  try {
    // Kiểm tra khóa học
    const courseResult = await pool.query(
      "SELECT course_id FROM courses WHERE course_id = $1",
      [course_id]
    );

    if (courseResult.rows.length === 0) {
      return res.status(404).json({ error: "Khóa học không tồn tại" });
    }

    // Kiểm tra đăng ký
    const enrollResult = await pool.query(
      "SELECT * FROM enrollments WHERE user_uid = $1 AND course_id = $2",
      [uid, course_id]
    );

    if (enrollResult.rows.length > 0) {
      return res.status(200).json({ enrolled: true });
    } else {
      return res.status(200).json({ enrolled: false });
    }
  } catch (err) {
    res.status(500).json({ error: "Lỗi kiểm tra đăng ký: " + err.message });
  }
};

module.exports = checkEnrollStatus;
