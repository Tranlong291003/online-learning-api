// File: controllers/questions/createQuestionFromAi.js
const { sql, poolPromise } = require("../../config/db.config");
const { OpenAI } = require("openai");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const createQuestionFromAi = async (req, res) => {
  const {
    quiz_id,
    topic,
    number = 3,
    difficulty = "trung_binh",
    type = "trac_nghiem",
    uid,
    language = "vi",
  } = req.body;

  if (!uid || !quiz_id || !topic) {
    return res.status(400).json({ error: "Thiếu uid, quiz_id hoặc topic" });
  }

  try {
    const pool = await poolPromise;

    const checkRole = new sql.Request(pool);
    checkRole.input("uid", sql.NVarChar, uid);
    const roleRes = await checkRole.query(
      `SELECT role FROM users WHERE uid = @uid`
    );
    const role = roleRes.recordset[0]?.role;
    if (role !== "admin" && role !== "giang_vien") {
      return res
        .status(403)
        .json({ error: "Bạn không có quyền tạo câu hỏi AI" });
    }

    const quizCheckRequest = new sql.Request(pool);
    quizCheckRequest.input("quiz_id", sql.Int, quiz_id);
    const quizRes = await quizCheckRequest.query(
      `SELECT type FROM quizzes WHERE quiz_id = @quiz_id`
    );
    if (quizRes.recordset.length === 0) {
      return res.status(404).json({ error: "Quiz không tồn tại" });
    }

    const quizType = quizRes.recordset[0].type;
    if (quizType !== type) {
      return res.status(400).json({
        error: `Loại quiz không khớp: DB là '${quizType}', bạn gửi '${type}'`,
      });
    }

    const prompt = `
Bạn là một trợ lý giáo dục thông minh, chuyên tạo ra câu hỏi cho các kỳ thi.

Yêu cầu:
- Tạo ${number} câu hỏi dạng ${
      type === "trac_nghiem" ? "trắc nghiệm" : "tự luận"
    } về chủ đề "${topic}".
- Câu hỏi cần có độ khó: ${difficulty}, bằng ngôn ngữ ${
      language === "vi" ? "Tiếng Việt" : "English"
    }.
- KHÔNG lặp lại cấu trúc, hãy viết mỗi câu theo một phong cách hoặc hướng khác nhau để tạo sự đa dạng.
- KHÔNG sử dụng từ "là gì" trong tất cả câu hỏi.
- KHÔNG tạo câu hỏi dạng định nghĩa trơn. Hãy đưa tình huống, mã giả, phân tích hoặc mô tả.

Nếu là trắc nghiệm, mỗi câu phải gồm:
{
  "question": "Nội dung câu hỏi",
  "options": ["Lựa chọn A", "Lựa chọn B", "Lựa chọn C", "Lựa chọn D"],
  "correct_index": số từ 1 đến 4 (chỉ định đáp án đúng)
}

Yêu cầu:
- Đáp án đúng phải rõ ràng, không gây tranh cãi
- Không trả về thêm lời giải thích nào khác
- Kết quả đầu ra PHẢI là mảng JSON THUẦN (không kèm theo \`\`\` hay ghi chú).
`;

    const aiResponse = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });

    let raw = aiResponse.choices[0].message.content.trim();
    if (raw.startsWith("```")) {
      raw = raw.replace(/```json|```/g, "").trim();
    }

    let questions;
    try {
      questions = JSON.parse(raw);
    } catch (err) {
      console.error("Lỗi parse JSON:", raw);
      return res
        .status(500)
        .json({ error: "AI trả về không đúng định dạng JSON" });
    }

    if (type === "trac_nghiem") {
      for (const q of questions) {
        if (
          !q.hasOwnProperty("correct_index") ||
          typeof q.correct_index !== "number" ||
          q.correct_index < 1 ||
          q.correct_index > 4 ||
          !Array.isArray(q.options) ||
          q.options.length !== 4 ||
          typeof q.options[q.correct_index - 1] !== "string"
        ) {
          return res.status(400).json({
            error:
              "Một hoặc nhiều câu hỏi thiếu correct_index hợp lệ hoặc options không đúng định dạng",
            question: q,
          });
        }
      }
    }

    await Promise.all(
      questions.map(async (q) => {
        const question = q.question;
        const options =
          type === "trac_nghiem" ? JSON.stringify(q.options) : null;
        const correct_index =
          type === "trac_nghiem" ? q.correct_index - 1 : null;
        const expected_keywords =
          type === "tu_luan" ? q.expected_keywords?.join(", ") : null;

        const insert = new sql.Request(pool);
        insert.input("quiz_id", sql.Int, quiz_id);
        insert.input("question", sql.NVarChar, question);
        insert.input("options", sql.NVarChar, options);
        insert.input("correct_index", sql.Int, correct_index);
        insert.input("expected_keywords", sql.NVarChar, expected_keywords);

        await insert.query(`
          INSERT INTO quiz_questions (
            quiz_id, question, options, correct_index, expected_keywords, created_at
          )
          VALUES (
            @quiz_id, @question, @options, @correct_index, @expected_keywords, GETDATE()
          )
        `);
      })
    );

    res.status(201).json({
      message: `✅ Đã tạo thành công ${questions.length} câu hỏi từ AI`,
      topic,
      questions,
    });
  } catch (err) {
    console.error("Lỗi tạo câu hỏi từ AI:", err);
    res
      .status(500)
      .json({ error: "Lỗi khi tạo câu hỏi từ AI: " + err.message });
  }
};

module.exports = createQuestionFromAi;
