const { sql, poolPromise } = require("../../config/db.config");
const { OpenAI } = require("openai");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const getQuizResultById = async (req, res) => {
  const { result_id } = req.params; // result_id từ URL

  try {
    const pool = await poolPromise;
    const request = new sql.Request(pool);

    // Lấy kết quả từ bảng quiz_results
    request.input("result_id", sql.Int, result_id);
    const result = await request.query(
      "SELECT * FROM quiz_results WHERE result_id = @result_id"
    );

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy kết quả bài làm" });
    }

    const quiz_id = result.recordset[0].quiz_id;
    const uid = result.recordset[0].user_uid;
    const answersData = result.recordset[0].answers;

    if (!answersData) {
      return res.status(400).json({
        error: "Dữ liệu câu trả lời (answers) đang null hoặc rỗng",
      });
    }

    let userAnswers;
    try {
      userAnswers = JSON.parse(answersData);
    } catch (error) {
      return res.status(400).json({
        error: "Dữ liệu câu trả lời không phải JSON hợp lệ",
        details: error.message,
      });
    }

    request.input("quiz_id", sql.Int, quiz_id);
    const questions = await request.query(
      "SELECT question_id, question, options, correct_index FROM quiz_questions WHERE quiz_id = @quiz_id"
    );

    const questionWithAnswers = await Promise.all(
      questions.recordset.map(async (q, index) => {
        let parsedOptions = [];
        try {
          parsedOptions = JSON.parse(q.options);
        } catch (parseOptionsError) {
          console.error("Lỗi parse options:", parseOptionsError);
        }

        const userAnswer = userAnswers[q.question_id] ?? null;
        const isCorrect = userAnswer === q.correct_index;
        let explanation = null;

        if (!isCorrect) {
          const aiPrompt = `Giải thích vì sao phương án đúng của câu hỏi sau là đáp án số ${
            q.correct_index + 1
          }:
Câu hỏi: ${q.question}
Các lựa chọn: ${parsedOptions.join(" | ")}`;

          try {
            const aiResponse = await openai.chat.completions.create({
              model: "gpt-3.5-turbo",
              messages: [{ role: "user", content: aiPrompt }],
            });
            explanation = aiResponse.choices[0].message.content;
          } catch (err) {
            explanation = "Không thể lấy giải thích từ AI.";
          }
        }

        return {
          question_id: q.question_id,
          question: q.question,
          options: parsedOptions,
          correct_answer: q.correct_index,
          user_answer: userAnswer,
          is_correct: isCorrect,
          explanation,
        };
      })
    );

    return res.json({
      message: "Kết quả bài làm",
      data: {
        quiz_id,
        user_uid: uid,
        score: result.recordset[0].score,
        explanation: result.recordset[0].explanation,
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
