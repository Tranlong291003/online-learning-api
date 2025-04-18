const { sql, poolConnect } = require("../../config/db.config");

const getQuestionsByQuiz = async (req, res) => {
  const { quiz_id } = req.params; // quiz_id từ URL

  try {
    const pool = await poolConnect; // Đảm bảo kết nối đã được thiết lập
    const request = new sql.Request(pool);

    // Kiểm tra quiz có tồn tại hay không
    request.input("quiz_id", sql.Int, quiz_id);
    const quizResult = await request.query(
      "SELECT quiz_id FROM quizzes WHERE quiz_id = @quiz_id"
    );

    if (quizResult.recordset.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy quiz này" });
    }

    // Lấy toàn bộ câu hỏi của quiz
    const questionResult = await request.query(
      "SELECT * FROM quiz_questions WHERE quiz_id = @quiz_id"
    );

    if (questionResult.recordset.length === 0) {
      return res
        .status(404)
        .json({ error: "Không tìm thấy câu hỏi cho bài kiểm tra này" });
    }

    // Trả về danh sách câu hỏi
    return res.json({
      message: "Danh sách câu hỏi của bài kiểm tra",
      data: questionResult.recordset,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "Lỗi khi lấy danh sách câu hỏi: " + err.message,
    });
  }
};

module.exports = getQuestionsByQuiz;
