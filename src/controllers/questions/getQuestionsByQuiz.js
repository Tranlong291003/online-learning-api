const { pool } = require("../../config/db.config");

const getQuestionsByQuiz = async (req, res) => {
  const { quiz_id } = req.params;

  try {
    // Kiểm tra quiz tồn tại
    const quizResult = await pool.query(
      "SELECT quiz_id FROM quizzes WHERE quiz_id = $1",
      [quiz_id]
    );

    if (quizResult.rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy quiz này" });
    }

    // Lấy toàn bộ câu hỏi
    const questionResult = await pool.query(
      "SELECT * FROM quiz_questions WHERE quiz_id = $1",
      [quiz_id]
    );

    if (questionResult.rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy câu hỏi cho bài kiểm tra này" });
    }

    return res.json({
      message: "Danh sách câu hỏi của bài kiểm tra",
      data: questionResult.rows,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Lỗi khi lấy danh sách câu hỏi: " + err.message });
  }
};

module.exports = getQuestionsByQuiz;
