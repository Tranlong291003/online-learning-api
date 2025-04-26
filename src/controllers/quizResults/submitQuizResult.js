const { sql, poolPromise } = require("../../config/db.config");

const submitQuizResult = async (req, res) => {
  const { uid, quiz_id, answers, score, explanation } = req.body;

  if (!uid || !quiz_id || !answers) {
    return res
      .status(400)
      .json({ error: "Thiếu user_uid, quiz_id hoặc câu trả lời" });
  }

  try {
    const pool = await poolPromise;
    const request = new sql.Request(pool);

    // Lấy loại quiz
    request.input("quiz_id", sql.Int, quiz_id);
    const quizResult = await request.query(`
      SELECT [type] FROM quizzes WHERE quiz_id = @quiz_id
    `);

    if (quizResult.recordset.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy bài kiểm tra" });
    }

    const quizType = quizResult.recordset[0].type;

    // Lấy danh sách câu hỏi hợp lệ thuộc quiz
    const validQuestionsQuery = await request.query(`
      SELECT question_id, correct_index
      FROM quiz_questions
      WHERE quiz_id = @quiz_id
    `);

    const validQuestions = validQuestionsQuery.recordset;
    const validQuestionMap = {};
    validQuestions.forEach(
      (q) => (validQuestionMap[q.question_id] = q.correct_index)
    );

    let correctCount = 0;
    let invalidQuestions = [];

    // Kiểm tra từng đáp án gửi lên
    for (const [questionIdStr, userAnswer] of Object.entries(answers)) {
      const questionId = parseInt(questionIdStr);
      if (!validQuestionMap.hasOwnProperty(questionId)) {
        invalidQuestions.push(questionId);
        continue;
      }

      const correctIndex = validQuestionMap[questionId];
      if (userAnswer === correctIndex) {
        correctCount++;
      }
    }

    const totalQuestions = validQuestions.length;
    const finalScore = totalQuestions
      ? Math.round((correctCount / totalQuestions) * 10)
      : 0;

    // Ghi nhận kết quả
    const insertRequest = new sql.Request(pool);
    insertRequest.input("user_uid", sql.NVarChar, uid);
    insertRequest.input("quiz_id", sql.Int, quiz_id);
    insertRequest.input("score", sql.Float, finalScore);
    insertRequest.input("answers", sql.NVarChar, JSON.stringify(answers));
    insertRequest.input("explanation", sql.NVarChar, explanation || "");

    await insertRequest.query(`
      INSERT INTO quiz_results (
        user_uid, quiz_id, score, submitted_at, answers, explanation, status
      ) VALUES (
        @user_uid, @quiz_id, @score, GETDATE(), @answers, @explanation, '${
          quizType === "trac_nghiem" ? "da_cham" : "cho_cham"
        }'
      )
    `);

    res.status(201).json({
      message:
        quizType === "trac_nghiem"
          ? "Nộp bài và chấm điểm tự động thành công"
          : "Bài làm đã được nộp, chờ giảng viên chấm điểm",
      score: finalScore,
      total_questions: totalQuestions,
      correct_answers: correctCount,
      invalid_question_ids: invalidQuestions,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi khi nộp bài làm: " + err.message });
  }
};

module.exports = submitQuizResult;
