// controllers/checkEnrollStatus.js
const { sql, poolPromise } = require("../../config/db.config");

const checkEnrollStatus = async (req, res) => {
  const { uid, course_id } = req.params; // Dùng uid và course_id từ tham số đường dẫn

  if (!uid || !course_id) {
    return res.status(400).json({ error: "Thiếu uid hoặc course_id" });
  }

  try {
    const pool = await poolPromise;
    const request = new sql.Request(pool);

    // Kiểm tra khóa học có tồn tại
    request.input("course_id", sql.Int, course_id);
    const courseResult = await request.query(`
      SELECT course_id FROM courses WHERE course_id = @course_id
    `);

    if (courseResult.recordset.length === 0) {
      return res.status(404).json({ error: "Khóa học không tồn tại" });
    }

    // Kiểm tra người dùng đã đăng ký khóa học chưa
    request.input("user_uid", sql.NVarChar, uid);
    const enrollResult = await request.query(`
      SELECT * FROM enrollments
      WHERE user_uid = @user_uid AND course_id = @course_id
    `);

    if (enrollResult.recordset.length > 0) {
      return res.status(200).json({ enrolled: true });
    } else {
      return res.status(200).json({ enrolled: false });
    }
  } catch (err) {
    res.status(500).json({ error: "Lỗi kiểm tra đăng ký: " + err.message });
  }
};

module.exports = checkEnrollStatus;
