const { sql, poolConnect, pool } = require("../../config/db.config");

const createQuiz = async (req, res) => {
  const { course_id, title, type, time_limit, passing_score, attempt_limit } =
    req.body;

  if (!course_id || !title) {
    return res
      .status(400)
      .json({ error: "Thiếu thông tin khóa học hoặc tiêu đề bài kiểm tra" });
  }

  try {
    const pool = await poolConnect; // Đảm bảo kết nối đã được thiết lập
    const request = new sql.Request(pool);
    request.input("course_id", sql.Int, course_id);
    request.input("title", sql.NVarChar, title);
    request.input("type", sql.NVarChar, type || "trac_nghiem");
    request.input("time_limit", sql.Int, time_limit);
    request.input("passing_score", sql.Int, passing_score);
    request.input("attempt_limit", sql.Int, attempt_limit);

    // Thêm bài kiểm tra mới
    const result = await request.query(
      "INSERT INTO quizzes (course_id, title, type, time_limit, passing_score, attempt_limit, created_at) " +
        "VALUES (@course_id, @title, @type, @time_limit, @passing_score, @attempt_limit, GETDATE())"
    );

    // Lấy thông tin bài kiểm tra đã được tạo (bao gồm created_at)
    const newQuiz = await request.query(
      "SELECT * FROM quizzes WHERE course_id = @course_id AND title = @title"
    );

    res.status(201).json({
      message: "Bài kiểm tra đã được tạo thành công",
      data: newQuiz.recordset[0], // Trả về bài kiểm tra vừa tạo
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi khi tạo bài kiểm tra: " + err.message });
  }
};

module.exports = createQuiz;
