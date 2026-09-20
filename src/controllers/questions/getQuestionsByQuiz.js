const { pool } = require("../../config/db.config");
const { parsePositiveInt } = require("../../utils/parseId");
const { sendServerError } = require("../../utils/errorResponse");

const getQuestionsByQuiz = async (req, res) => {
  const quiz_id = parsePositiveInt(req.params.quiz_id);

  if (!quiz_id) {
    return res.status(400).json({ error: "quiz_id không hợp lệ" });
  }

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
    return sendServerError(res, "Lỗi khi lấy danh sách câu hỏi", err);
  }
};

module.exports = getQuestionsByQuiz;
