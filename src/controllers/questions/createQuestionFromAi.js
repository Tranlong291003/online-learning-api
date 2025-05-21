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
    if (role !== "admin" && role !== "mentor") {
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
Bạn là một chuyên gia giáo dục với nhiều năm kinh nghiệm trong việc tạo câu hỏi kiểm tra chất lượng cao.

Yêu cầu tạo ${number} câu hỏi ${
      type === "trac_nghiem" ? "trắc nghiệm" : "tự luận"
    } về chủ đề "${topic}":

1. Yêu cầu chung:
- Độ khó: ${difficulty}
- Ngôn ngữ: ${language === "vi" ? "Tiếng Việt" : "English"}
- Mỗi câu hỏi phải có tính thực tế và ứng dụng cao
- Tuyệt đối không sử dụng từ "là gì", "định nghĩa", "giải thích"
- Tránh các câu hỏi dạng liệt kê hoặc học thuộc lòng
- Mỗi câu hỏi phải có một tình huống cụ thể hoặc vấn đề thực tế cần giải quyết

2. Yêu cầu về nội dung:
- Câu hỏi phải rõ ràng, không gây nhầm lẫn
- Đáp án phải chính xác và không gây tranh cãi
- Nếu là trắc nghiệm, các lựa chọn phải có độ dài tương đương
- Các lựa chọn sai phải hợp lý và có tính phân biệt
- Tránh các câu hỏi quá dễ đoán hoặc quá khó

3. Định dạng JSON cho câu hỏi trắc nghiệm:
{
  "question": "Câu hỏi phải bắt đầu bằng động từ hoặc câu hỏi Wh-",
  "options": [
    "Lựa chọn A (phải có tính phân biệt)",
    "Lựa chọn B (phải có tính phân biệt)",
    "Lựa chọn C (phải có tính phân biệt)",
    "Lựa chọn D (phải có tính phân biệt)"
  ],
  "correct_index": số từ 1 đến 4 (chỉ định đáp án đúng, 1 là đáp án đầu tiên)
}

Lưu ý:
- Chỉ trả về mảng JSON thuần, không kèm theo markdown hoặc ghi chú
- Mỗi câu hỏi phải độc lập và không phụ thuộc vào câu hỏi khác
- Đảm bảo tính nhất quán trong ngôn ngữ và phong cách
`;

    const aiResponse = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 2000,
      presence_penalty: 0.6,
      frequency_penalty: 0.3,
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

    // Kiểm tra cấu trúc câu hỏi
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        error: "AI trả về không phải mảng câu hỏi hoặc mảng rỗng",
      });
    }

    if (type === "trac_nghiem") {
      for (const q of questions) {
        // Kiểm tra cấu trúc câu hỏi
        if (!q.question || typeof q.question !== "string") {
          return res.status(400).json({
            error: "Câu hỏi không hợp lệ",
            question: q,
          });
        }

        // Kiểm tra cấu trúc options
        if (!Array.isArray(q.options) || q.options.length !== 4) {
          return res.status(400).json({
            error: "Options phải là mảng có đúng 4 phần tử",
            question: q,
          });
        }

        // Kiểm tra correct_index chi tiết hơn
        if (typeof q.correct_index !== "number") {
          return res.status(400).json({
            error: "correct_index phải là số",
            question: q,
          });
        }

        // Chuyển đổi correct_index từ 0-based sang 1-based nếu cần
        if (q.correct_index >= 0 && q.correct_index <= 3) {
          q.correct_index = q.correct_index + 1;
        }

        // Kiểm tra sau khi chuyển đổi
        if (q.correct_index < 1 || q.correct_index > 4) {
          return res.status(400).json({
            error: "correct_index phải là số từ 1 đến 4 (1 là đáp án đầu tiên)",
            question: q,
            current_index: q.correct_index,
            options: q.options,
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
          type === "trac_nghiem" ? q.correct_index - 1 : null; // Chuyển từ 1-based sang 0-based
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
