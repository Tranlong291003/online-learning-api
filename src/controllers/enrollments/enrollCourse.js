const { sql, poolPromise } = require("../../config/db.config");

const enrollCourse = async (req, res) => {
  const { uid, course_id } = req.body; // Dùng uid thay vì user_id

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

    // Kiểm tra đã đăng ký chưa
    request.input("user_uid", sql.NVarChar, uid);
    const exist = await request.query(`
      SELECT * FROM enrollments
      WHERE user_uid = @user_uid AND course_id = @course_id
    `);

    if (exist.recordset.length > 0) {
      return res.status(400).json({ error: "Bạn đã đăng ký khóa học này" });
    }

    // Thực hiện đăng ký
    await request.query(`
      INSERT INTO enrollments (user_uid, course_id, enrolled_at)
      VALUES (@user_uid, @course_id, GETDATE())
    `);

    res.status(201).json({ message: "Đăng ký khóa học thành công" });
  } catch (err) {
    res.status(500).json({ error: "Lỗi đăng ký học: " + err.message });
  }
};

module.exports = enrollCourse;
