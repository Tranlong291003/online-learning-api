const { sql, poolPromise } = require("../../config/db.config");
const { OpenAI } = require("openai");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * POST /api/quiz/submit
 * Body: { uid, quiz_id, answers: { [question_id]: index|null }, explanation? }
 */
const submitQuizResult = async (req, res) => {
  const { uid, quiz_id, answers = {}, explanation } = req.body;

  if (!uid || !quiz_id || !answers) {
    return res
      .status(400)
      .json({ error: "Thiếu user_uid, quiz_id hoặc câu trả lời" });
  }

  try {
    /* 1. Kết nối DB */
    const pool = await poolPromise;
    const request = new sql.Request(pool);

    /* 2. Lấy loại quiz */
    request.input("quiz_id", sql.Int, quiz_id);
    const quizRow = await request.query(`
      SELECT [type] FROM quizzes WHERE quiz_id = @quiz_id
    `);
    if (quizRow.recordset.length === 0)
      return res.status(404).json({ error: "Không tìm thấy bài kiểm tra" });

    const quizType = quizRow.recordset[0].type; // 'trac_nghiem' | ...

    /* 3. Lấy tất cả câu hỏi của quiz  (để chấm & giải thích) */
    const qRows = await request.query(`
      SELECT question_id, question, options, correct_index
      FROM quiz_questions
      WHERE quiz_id = @quiz_id
    `);

    const questionMap = {}; // { id: {question, options[], correct_index} }
    qRows.recordset.forEach((q) => {
      questionMap[q.question_id] = {
        text: q.question,
        options: JSON.parse(q.options),
        correct: q.correct_index,
      };
    });

    /* 4. Chấm điểm + gom dữ liệu cho AI */
    let correctCount = 0;
    let totalAnswered = 0;
    const invalidQuestions = [];
    const questionDetails = []; // push để trả client

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
        user_answer: userAns, // null nếu bỏ qua
        is_correct: isCorrect,
      });
    }

    /* 5. Gọi OpenAI để giải thích từng câu (cả sai & bỏ qua) */
    await Promise.all(
      questionDetails.map(async (q) => {
        const prompt = `
Bạn là trợ lý giáo dục, giải thích ngắn gọn và dễ hiểu.
Câu hỏi: ${q.question}
Các lựa chọn: ${q.options.map((o, i) => `${i + 1}. ${o}`).join("  |  ")}
Đáp án đúng: ${q.correct_answer + 1}. ${q.options[q.correct_answer]}
Người học ${
          q.user_answer === null
            ? "chưa chọn đáp án"
            : `đã chọn: ${q.user_answer + 1}. ${q.options[q.user_answer]}`
        }.
Hãy giải thích vì sao đáp án đúng là lựa chọn trên (nêu ngắn gọn).`;

        try {
          const aiRes = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 120,
          });
          q.ai_explanation = aiRes.choices[0].message.content.trim();
        } catch {
          q.ai_explanation = "Không thể lấy giải thích từ AI.";
        }
      })
    );

    /* 6. Điểm */
    const rawScore = totalAnswered ? (correctCount / totalAnswered) * 10 : 0;
    const finalScore = Math.round(rawScore * 10) / 10;

    /* 7. Lưu kết quả (không lưu AI-explanation) */
    const insertReq = new sql.Request(pool);
    insertReq.input("user_uid", sql.NVarChar, uid);
    insertReq.input("quiz_id", sql.Int, quiz_id);
    insertReq.input("score", sql.Float, finalScore);
    insertReq.input("answers", sql.NVarChar, JSON.stringify(answers));
    insertReq.input("explanation", sql.NVarChar, explanation || "");
    const insertRes = await insertReq.query(`
      INSERT INTO quiz_results (
        user_uid, quiz_id, score, submitted_at,
        answers, explanation, status
      )
      OUTPUT INSERTED.result_id
      VALUES (
        @user_uid, @quiz_id, @score, GETDATE(), @answers, @explanation,
        '${quizType === "trac_nghiem" ? "da_cham" : "cho_cham"}'
      )
    `);
    const resultId = insertRes.recordset[0].result_id;

    /* 8. Trả phản hồi */
    return res.status(201).json({
      message:
        quizType === "trac_nghiem"
          ? "Nộp bài và chấm điểm tự động thành công"
          : "Bài làm đã được nộp, chờ giảng viên chấm điểm",
      result_id: resultId,
      score: finalScore,
      total_answered: totalAnswered,
      correct_answers: correctCount,
      invalid_question_ids: invalidQuestions,
      questions: questionDetails, // chứa ai_explanation
    });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ error: "Lỗi khi nộp bài làm: " + err.message });
  }
};

module.exports = submitQuizResult;
