const { sql, poolConnect, pool } = require("../config/db.config");

exports.getQuizzesByCourse = async (req, res) => {
  const { course_id } = req.params;

  try {
    const pool = await poolConnect; // Đảm bảo kết nối đã được thiết lập
    const request = new sql.Request(pool);
    request.input("course_id", sql.Int, course_id);

    const result = await request.query(
      "SELECT * FROM quizzes WHERE course_id = @course_id"
    );

    if (result.recordset.length === 0) {
      return res
        .status(404)
        .json({ error: "Không tìm thấy bài kiểm tra cho khóa học này" });
    }

    res.json({
      message: "Danh sách bài kiểm tra của khóa học",
      data: result.recordset,
    });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: "Lỗi khi lấy danh sách bài kiểm tra: " + err.message });
  }
};

exports.createQuiz = async (req, res) => {
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

exports.updateQuiz = async (req, res) => {
  const { quiz_id } = req.params;
  const { title, type, time_limit, passing_score, attempt_limit } = req.body;

  if (!title) {
    return res
      .status(400)
      .json({ error: "Tiêu đề bài kiểm tra không được bỏ trống" });
  }

  try {
    const pool = await poolConnect; // Đảm bảo kết nối đã được thiết lập
    const request = new sql.Request(pool);
    request.input("quiz_id", sql.Int, quiz_id);
    request.input("title", sql.NVarChar, title);
    request.input("type", sql.NVarChar, type);
    request.input("time_limit", sql.Int, time_limit);
    request.input("passing_score", sql.Int, passing_score);
    request.input("attempt_limit", sql.Int, attempt_limit);

    const result = await request.query(
      "UPDATE quizzes SET title = @title, type = @type, time_limit = @time_limit, passing_score = @passing_score, attempt_limit = @attempt_limit, updated_at = GETDATE() " +
        "WHERE quiz_id = @quiz_id"
    );

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: "Bài kiểm tra không tồn tại" });
    }

    // Lấy thông tin bài kiểm tra đã cập nhật (bao gồm updated_at)
    const updatedQuiz = await request.query(
      "SELECT * FROM quizzes WHERE quiz_id = @quiz_id"
    );

    res.status(200).json({
      message: "Cập nhật bài kiểm tra thành công",
      data: updatedQuiz.recordset[0], // Trả về bài kiểm tra đã cập nhật
    });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: "Lỗi khi cập nhật bài kiểm tra: " + err.message });
  }
};

exports.deleteQuiz = async (req, res) => {
  const { quiz_id } = req.params;

  try {
    const pool = await poolConnect; // Đảm bảo kết nối đã được thiết lập
    const request = new sql.Request(pool);
    request.input("quiz_id", sql.Int, quiz_id);

    const result = await request.query(
      "DELETE FROM quizzes WHERE quiz_id = @quiz_id"
    );

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: "Bài kiểm tra không tồn tại" });
    }

    res.status(200).json({ message: "Xóa bài kiểm tra thành công" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi khi xóa bài kiểm tra: " + err.message });
  }
};
