const { sql, poolPromise } = require("../../config/db.config");
const { OpenAI } = require("openai");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const getQuizResultById = async (req, res) => {
  const { result_id } = req.params;

  try {
    /* 1. Kết nối DB */
    const pool = await poolPromise;
    const request = new sql.Request(pool);

    /* 2. Lấy bản ghi kết quả */
    request.input("result_id", sql.Int, result_id);
    const result = await request.query(
      "SELECT * FROM quiz_results WHERE result_id = @result_id"
    );

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy kết quả bài làm" });
    }

    const {
      quiz_id,
      user_uid: uid,
      answers: answersData,
      score,
      explanation,
    } = result.recordset[0];

    if (!answersData) {
      return res
        .status(400)
        .json({ error: "Dữ liệu câu trả lời (answers) đang null hoặc rỗng" });
    }

    /* 3. Parse answers */
    let userAnswers;
    try {
      userAnswers = JSON.parse(answersData); // { [question_id]: index | null }
    } catch (error) {
      return res.status(400).json({
        error: "Dữ liệu câu trả lời không phải JSON hợp lệ",
        details: error.message,
      });
    }

    /* 4. Lấy danh sách câu hỏi mà user đã gửi (kể cả null) */
    const questionIds = Object.keys(userAnswers).map((id) => parseInt(id, 10));
    if (questionIds.length === 0) {
      return res
        .status(400)
        .json({ error: "Không có câu trả lời nào được nộp" });
    }

    const inParams = questionIds.map((_, i) => `@id${i}`).join(", ");
    questionIds.forEach((id, i) => request.input(`id${i}`, sql.Int, id));
    request.input("quiz_id", sql.Int, quiz_id);

    const questions = await request.query(`
      SELECT question_id, question, options, correct_index
      FROM quiz_questions
      WHERE quiz_id = @quiz_id AND question_id IN (${inParams})
    `);

    /* 5. Ghép câu hỏi + đáp án, sinh AI explanation cho mọi câu sai/bỏ qua */
    const questionWithAnswers = await Promise.all(
      questions.recordset.map(async (q) => {
        let parsedOptions = [];
        try {
          parsedOptions = JSON.parse(q.options);
        } catch (_) {}

        const userAnswer = userAnswers[q.question_id]; // có thể null
        const isCorrect = userAnswer !== null && userAnswer === q.correct_index;

        let aiExplanation = null;
        if (!isCorrect) {
          const aiPrompt = `Giải thích ngắn gọn về câu hỏi trắc nghiệm sau:

Câu hỏi: ${q.question}

Các lựa chọn:
${parsedOptions.map((opt, idx) => `${idx + 1}. ${opt}`).join("\n")}

Đáp án đúng là: ${q.correct_index + 1}

Yêu cầu:
1. Giải thích ngắn gọn (2-3 câu) tại sao đáp án ${q.correct_index + 1} là đúng
2. Nêu ngắn gọn lý do chính khiến các đáp án khác không phù hợp
3. Tóm tắt trong 1 câu điểm quan trọng cần nhớ

Lưu ý:
- Giải thích phải ngắn gọn, súc tích
- Tập trung vào lý do chính
- Tránh giải thích dài dòng`;

          try {
            const aiRes = await openai.chat.completions.create({
              model: "gpt-3.5-turbo",
              messages: [{ role: "user", content: aiPrompt }],
              temperature: 0.7,
              max_tokens: 300,
              presence_penalty: 0.6,
              frequency_penalty: 0.3,
            });
            aiExplanation = aiRes.choices[0].message.content;
          } catch {
            aiExplanation = "Không thể lấy giải thích từ AI.";
          }
        }

        return {
          question_id: q.question_id,
          question: q.question,
          options: parsedOptions,
          correct_answer: q.correct_index,
          user_answer: userAnswer, // null nếu bỏ qua
          is_correct: isCorrect,
          explanation: aiExplanation, // luôn có khi sai/bỏ qua
        };
      })
    );

    /* 6. Thống kê */
    const totalCorrect = questionWithAnswers.filter((q) => q.is_correct).length;
    const totalWrong = questionWithAnswers.length - totalCorrect; // gồm cả bỏ qua

    /* 7. Trả kết quả */
    return res.json({
      message: "Kết quả bài làm",
      data: {
        quiz_id,
        user_uid: uid,
        score,
        explanation,
        total_correct_answers: totalCorrect,
        total_wrong_answers: totalWrong,
        questions: questionWithAnswers,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "Lỗi khi lấy kết quả bài làm: " + err.message,
    });
  }
};

module.exports = getQuizResultById;
