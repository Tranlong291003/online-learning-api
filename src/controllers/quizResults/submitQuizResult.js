const { pool } = require("../../config/db.config");
const { sendServerError } = require("../../utils/errorResponse");
const { resolveActorUid } = require("../../middleware/actor");

/**
 * POST /api/quiz/submit
 * Body: { quiz_id, answers: { [question_id]: index|null }, explanation? }
 * uid được lấy từ token (chỉ admin mới được nộp thay người khác).
 */
const submitQuizResult = async (req, res) => {
  const { quiz_id, answers = {}, explanation } = req.body;

  if (!quiz_id || !answers) {
    return res.status(400).json({ error: "Thiếu quiz_id hoặc câu trả lời" });
  }

  // Chống type-confusion: answers phải là plain object, không phải string/null/array.
  if (typeof answers !== "object" || Array.isArray(answers) || answers === null) {
    return res.status(400).json({ error: "answers phải là object {question_id: index}" });
  }

  // Chống DoS: giới hạn số câu trả lời gửi lên. 500 là đủ cho bất kỳ quiz nào
  // trong hệ thống; giá trị lớn hơn sẽ tạo vòng lặp lớn và INSERT quá khổ vào DB.
  const MAX_ANSWERS = 500;
  if (Object.keys(answers).length > MAX_ANSWERS) {
    return res.status(400).json({ error: `Số câu trả lời vượt quá giới hạn cho phép (tối đa ${MAX_ANSWERS})` });
  }

  // Giới hạn độ dài explanation để chống DB bloat.
  const MAX_EXPLANATION_LEN = 2000;
  if (explanation != null && (typeof explanation !== "string" || explanation.length > MAX_EXPLANATION_LEN)) {
    return res.status(400).json({ error: `explanation phải là chuỗi tối đa ${MAX_EXPLANATION_LEN} ký tự` });
  }

  // Lấy uid từ token; chỉ admin mới được thao tác thay người khác
  const uid = resolveActorUid(req, res, req.body.uid);
  if (!uid) return;

  try {
    // Lấy loại quiz
    const quizRow = await pool.query("SELECT type FROM quizzes WHERE quiz_id = $1", [quiz_id]);
    if (quizRow.rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy bài kiểm tra" });
    }

    const quizType = quizRow.rows[0].type;

    // Lấy tất cả câu hỏi
    const qRows = await pool.query(
      "SELECT question_id, question, options, correct_index FROM quiz_questions WHERE quiz_id = $1",
      [quiz_id]
    );

    const questionMap = {};
    qRows.rows.forEach((q) => {
      // options có thể NULL hoặc không phải JSON hợp lệ (dữ liệu cũ)
      let parsedOptions = null;
      if (q.options != null) {
        try {
          parsedOptions = JSON.parse(q.options);
        } catch {
          parsedOptions = null;
        }
      }
      questionMap[q.question_id] = {
        text: q.question,
        options: parsedOptions,
        correct: q.correct_index,
      };
    });

    // Chấm điểm
    let correctCount = 0;
    let totalAnswered = 0;
    const invalidQuestions = [];
    const questionDetails = [];

    for (const [qidStr, userAns] of Object.entries(answers)) {
      const qid = parseInt(qidStr, 10);
      const qInfo = questionMap[qid];

      if (!qInfo) {
        invalidQuestions.push(qid);
        continue;
      }

      totalAnswered++;
      const isCorrect = userAns !== null && userAns === qInfo.correct;
      if (isCorrect) correctCount++;

      questionDetails.push({
        question_id: qid,
        question: qInfo.text,
        options: qInfo.options,
        correct_answer: qInfo.correct,
        user_answer: userAns,
        is_correct: isCorrect,
      });
    }

    // Điểm
    const rawScore = totalAnswered ? (correctCount / totalAnswered) * 10 : 0;
    const finalScore = Math.round(rawScore * 10) / 10;

    // Lưu kết quả
    const status = quizType === "trac_nghiem" ? "da_cham" : "cho_cham";
    const insertRes = await pool.query(
      `INSERT INTO quiz_results (user_uid, quiz_id, score, submitted_at, answers, explanation, status)
       VALUES ($1, $2, $3, NOW(), $4, $5, $6)
       RETURNING result_id`,
      [uid, quiz_id, finalScore, JSON.stringify(answers), explanation || "", status]
    );

    const resultId = insertRes.rows[0].result_id;

    return res.status(201).json({
      message: quizType === "trac_nghiem"
        ? "Nộp bài và chấm điểm tự động thành công"
        : "Bài làm đã được nộp, chờ giảng viên chấm điểm",
      result_id: resultId,
      score: finalScore,
      total_answered: totalAnswered,
      correct_answers: correctCount,
      invalid_question_ids: invalidQuestions,
      questions: questionDetails,
    });
  } catch (err) {
    console.error(err);
    return sendServerError(res, "Lỗi khi nộp bài làm", err);
  }
};

module.exports = submitQuizResult;
