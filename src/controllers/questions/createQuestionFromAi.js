const { pool } = require("../../config/db.config");
const { OpenAI } = require("openai");

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

const createQuestionFromAi = async (req, res) => {
  const {
    quiz_id,
    topic,
    number = 3,
    difficulty,
    type = "trac_nghiem",
    uid,
    language = "vi",
  } = req.body;

  if (!uid || !quiz_id || !topic) {
    return res.status(400).json({ error: "Thiếu uid, quiz_id hoặc topic" });
  }

  const allowedDifficulties = ["easy", "medium", "hard"];
  if (!allowedDifficulties.includes(difficulty)) {
    return res.status(400).json({
      error: "Giá trị difficulty không hợp lệ. Chỉ chấp nhận: easy, medium, hard",
    });
  }
  const difficultyMap = { easy: "dễ", medium: "trung bình", hard: "khó" };
  const difficultyText = difficultyMap[difficulty];

  try {
    const openai = getOpenAIClient();
    if (!openai) {
      return res.status(503).json({
        error: "OPENAI_API_KEY chưa được cấu hình. Endpoint tạo câu hỏi bằng AI tạm thời không khả dụng.",
      });
    }

    // Kiểm tra role
    const roleRes = await pool.query("SELECT role FROM users WHERE uid = $1", [uid]);
    const role = roleRes.rows[0]?.role;
    if (role !== "admin" && role !== "mentor") {
      return res.status(403).json({ error: "Bạn không có quyền tạo câu hỏi AI" });
    }

    // Kiểm tra quiz
    const quizRes = await pool.query("SELECT type FROM quizzes WHERE quiz_id = $1", [quiz_id]);
    if (quizRes.rows.length === 0) {
      return res.status(404).json({ error: "Quiz không tồn tại" });
    }

    const quizType = quizRes.rows[0].type;
    if (quizType !== type) {
      return res.status(400).json({
        error: `Loại quiz không khớp: DB là '${quizType}', bạn gửi '${type}'`,
      });
    }

    // Tạo prompt cho 1 câu hỏi
    const singlePrompt = (topic, difficulty) => `
Bạn là một chuyên gia giáo dục. Hãy tạo **một câu hỏi trắc nghiệm độc đáo** liên quan đến chủ đề "${topic}".

Yêu cầu:
- **Độ khó**: ${difficulty}
- **Ngôn ngữ**: Tiếng Việt
- **Hình thức**: 4 lựa chọn, 1 đáp án đúng

Định dạng trả về (chỉ JSON):
{
  "question": "...",
  "options": ["...", "...", "...", "..."],
  "correct_index": 1
}
`;

    // Gửi nhiều request song song
    const aiResponses = await Promise.all(
      Array.from({ length: number }).map(() =>
        openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [{ role: "user", content: singlePrompt(topic, difficultyText) }],
          temperature: 0.7,
          max_tokens: 700,
        })
      )
    );

    // Parse kết quả
    let questions = [];
    for (const resp of aiResponses) {
      let raw = resp.choices[0].message.content.trim();
      if (raw.startsWith("```")) {
        raw = raw.replace(/```json|```/g, "").trim();
      }
      try {
        const q = JSON.parse(raw);
        questions.push(q);
      } catch (err) {
        console.error("Lỗi parse JSON:", raw);
        return res.status(500).json({ error: "AI trả về không đúng định dạng JSON", raw });
      }
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: "AI trả về không phải mảng câu hỏi hoặc mảng rỗng" });
    }

    // Validate và fix correct_index
    if (type === "trac_nghiem") {
      for (const q of questions) {
        if (!q.question || typeof q.question !== "string") {
          return res.status(400).json({ error: "Câu hỏi không hợp lệ", question: q });
        }
        if (!Array.isArray(q.options) || q.options.length !== 4) {
          return res.status(400).json({ error: "Options phải là mảng có đúng 4 phần tử", question: q });
        }
        if (typeof q.correct_index !== "number" || !Number.isInteger(q.correct_index)) {
          return res.status(400).json({ error: "correct_index phải là số nguyên", question: q });
        }
        if (q.correct_index < 1 || q.correct_index > 4) {
          return res.status(400).json({ error: "correct_index phải là số từ 1 đến 4", question: q });
        }
      }
    }

    // Lưu vào DB
    await Promise.all(
      questions.map(async (q) => {
        const question = q.question;
        const options = type === "trac_nghiem" ? JSON.stringify(q.options) : null;
        const correct_index = type === "trac_nghiem" ? q.correct_index - 1 : null;
        await pool.query(
          `INSERT INTO quiz_questions (quiz_id, question, options, correct_index, created_at)
           VALUES ($1, $2, $3, $4, NOW())`,
          [quiz_id, question, options, correct_index]
        );
      })
    );

    res.status(201).json({
      message: `✅ Đã tạo thành công ${questions.length} câu hỏi từ AI`,
      topic,
      questions,
    });
  } catch (err) {
    console.error("Lỗi tạo câu hỏi từ AI:", err);
    res.status(500).json({ error: "Lỗi khi tạo câu hỏi từ AI: " + err.message });
  }
};

module.exports = createQuestionFromAi;
