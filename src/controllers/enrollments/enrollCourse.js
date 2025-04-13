const { sql, poolConnect, pool } = require("../../config/db.config");

const enrollCourse = async (req, res) => {
  const { user_id, course_id } = req.body; // Dùng user_id và course_id trong request body

  // Kiểm tra nếu user_id hoặc course_id không hợp lệ (null hoặc undefined)
  if (!user_id || !course_id) {
    return res.status(400).json({ error: "Thiếu user_id hoặc course_id" });
  }

  try {
    // Kiểm tra nếu người dùng đã đăng ký khóa học
    const existingEnrollment = await pool
      .request()
      .input("user_id", sql.Int, user_id)
      .input("course_id", sql.Int, course_id)
      .query(
        "SELECT * FROM enrollments WHERE user_id = @user_id AND course_id = @course_id"
      );

    if (existingEnrollment.recordset.length > 0) {
      return res
        .status(400)
        .json({ error: "Người dùng đã đăng ký khóa học này" });
    }

    // Nếu chưa đăng ký, thực hiện đăng ký
    await pool
      .request()
      .input("user_id", sql.Int, user_id)
      .input("course_id", sql.Int, course_id)
      .query(
        "INSERT INTO enrollments (user_id, course_id) VALUES (@user_id, @course_id)"
      );

    res.status(201).json({ message: "Đăng ký khóa học thành công" });
  } catch (err) {
    res.status(500).json({ error: "Lỗi đăng ký học: " + err.message });
  }
};

module.exports = enrollCourse;
