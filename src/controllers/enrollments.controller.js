const { sql, poolConnect, pool } = require("../config/db.config");

exports.enrollCourse = async (req, res) => {
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

exports.getCoursesByUser = async (req, res) => {
  try {
    const { user_id } = req.params; // Dùng user_id trong URL
    await poolConnect; // Đảm bảo kết nối đã được thiết lập
    const request = new sql.Request(pool);
    request.input("user_id", sql.Int, user_id);

    const result = await request.query(
      "SELECT * FROM enrollments WHERE user_id = @user_id"
    );

    res.json({
      message: "📚 Danh sách khóa học đã đăng ký",
      data: result.recordset,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteEnrollment = async (req, res) => {
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
