const { sql, poolPromise } = require("../../config/db.config");

const enrollCourse = async (req, res) => {
  const { user_id, course_id } = req.body; // Dùng user_id và course_id trong request body

  // Kiểm tra nếu user_id hoặc course_id không hợp lệ (null hoặc undefined)
  if (!user_id || !course_id) {
    return res.status(400).json({ error: "Thiếu user_id hoặc course_id" });
  }

  try {
    const pool = await poolPromise; // Sử dụng poolPromise để kết nối
    const request = new sql.Request(pool);

    // Kiểm tra xem khóa học có tồn tại hay không
    request.input("course_id", sql.Int, course_id);
    const courseResult = await request.query(
      "SELECT * FROM courses WHERE course_id = @course_id"
    );

    if (courseResult.recordset.length === 0) {
      return res.status(404).json({ error: "Khóa học không tồn tại" });
    }

    // Kiểm tra nếu người dùng đã đăng ký khóa học
    request.input("user_id", sql.Int, user_id);
    const existingEnrollment = await request.query(
      "SELECT * FROM enrollments WHERE user_id = @user_id AND course_id = @course_id"
    );

    if (existingEnrollment.recordset.length > 0) {
      return res.status(400).json({ error: "Bạn đã đăng ký khóa học này" });
    }

    // Nếu chưa đăng ký, thực hiện đăng ký
    await request.query(
      "INSERT INTO enrollments (user_id, course_id) VALUES (@user_id, @course_id)"
    );

    res.status(201).json({ message: "Đăng ký khóa học thành công" });
  } catch (err) {
    res.status(500).json({ error: "Lỗi đăng ký học: " + err.message });
  }
};

module.exports = enrollCourse;
