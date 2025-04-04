const { sql, poolConnect, pool } = require("../config/db.config");

exports.enrollCourse = async (req, res) => {
  try {
    const { user_id, course_id } = req.body;
    if (!user_id || !course_id) {
      return res.status(400).json({ error: "Thiếu user_id hoặc course_id" });
    }

    await poolConnect;
    const request = new sql.Request(pool);
    request.input("user_id", sql.Int, user_id);
    request.input("course_id", sql.Int, course_id);
    await request.query(
      `INSERT INTO enrollments (user_id, course_id) VALUES (@user_id, @course_id)`
    );

    res.status(201).json({ message: "✅ Đăng ký học thành công" });
  } catch (err) {
    res.status(500).json({ error: "❌ Lỗi đăng ký học: " + err.message });
  }
};

exports.getProgress = async (req, res) => {
  try {
    const { id } = req.params;
    await poolConnect;
    const request = new sql.Request(pool);
    request.input("id", sql.Int, id);
    const result = await request.query(
      `SELECT * FROM enrollments WHERE id = @id`
    );
    res.json({ message: "📊 Tiến độ học tập", data: result.recordset[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getCoursesByUser = async (req, res) => {
  try {
    const { id } = req.params;
    await poolConnect;
    const request = new sql.Request(pool);
    request.input("id", sql.Int, id);
    const result = await request.query(
      `SELECT * FROM enrollments WHERE user_id = @id`
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
    const { id } = req.params;
    await poolConnect;
    const request = new sql.Request(pool);
    request.input("id", sql.Int, id);
    const result = await request.query(
      `DELETE FROM enrollments WHERE id = @id`
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
