const { sql, poolConnect, pool } = require("../../config/db.config");

const updateQuiz = async (req, res) => {
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

module.exports = updateQuiz;
