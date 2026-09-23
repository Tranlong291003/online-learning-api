const { pool } = require("../../config/db.config");
const { parsePositiveInt } = require("../../utils/parseId");
const { sendServerError } = require("../../utils/errorResponse");
const { canManageQuiz } = require("../../utils/access");

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

    // Đáp án đúng chỉ trả cho người được phép chấm/sửa quiz (admin hoặc mentor
    // sở hữu quiz).
    //
    // Vì sao ẩn với học viên: server tự chấm điểm ở POST /quiz-results/submit,
    // nên đáp án là tri thức phía server — client không cần biết trước khi làm
    // bài. Nếu trả về, bất kỳ học viên nào cũng đọc được đáp án của mọi quiz
    // trước khi nộp. Học viên vẫn xem được đáp án SAU khi nộp qua
    // GET /quiz-results/:result_id (đã có sẵn và có kiểm tra chủ sở hữu).
    //
    // `expected_keywords` còn nhạy cảm hơn: đó là thang điểm của bài tự luận.
    const isGrader = req.user && (req.user.role === "admin" || (await canManageQuiz(quiz_id, req.user)).ok);

    const data = isGrader
      ? questionResult.rows
      : questionResult.rows.map((q) => {
          // Giữ nguyên mọi trường khác để FE dựng được đề bài; chỉ bỏ đáp án.
          const { correct_index, expected_keywords, ...safe } = q;
          return safe;
        });

    return res.json({
      message: "Danh sách câu hỏi của bài kiểm tra",
      data,
    });
  } catch (err) {
    console.error(err);
    return sendServerError(res, "Lỗi khi lấy danh sách câu hỏi", err);
  }
};

module.exports = getQuestionsByQuiz;
