const { pool } = require("../../config/db.config");
const { OpenAI } = require("openai");
const { resolveActorUid } = require("../../middleware/actor");

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
    language = "vi",
  } = req.body;

  if (!quiz_id || !topic) {
    return res.status(400).json({ error: "Thiếu quiz_id hoặc topic" });
  }

  // Lấy uid từ token; chỉ admin mới được thao tác thay người khác
  const uid = resolveActorUid(req, res, req.body.uid);
  if (!uid) return;

  const allowedDifficulties = ["easy", "medium", "hard"];
  if (!allowedDifficulties.includes(difficulty)) {
    return res.status(400).json({
      error: "Giá trị difficulty không hợp lệ. Chỉ chấp nhận: easy, medium, hard",
    });
  }

  // `number` được dùng trực tiếp làm độ dài mảng gọi OpenAI song song, nên phải
  // chặn ở đây: một số lớn (vd 1e6) sẽ tạo hàng trăm nghìn request đồng thời và
  // làm cạn heap của tiến trình Node (server sập OOM).
  const MAX_AI_QUESTIONS = 20;
  const count = Number(number);
  if (!Number.isInteger(count) || count < 1 || count > MAX_AI_QUESTIONS) {
    return res.status(400).json({
      error: `Số lượng câu hỏi không hợp lệ. Chỉ chấp nhận số nguyên từ 1 đến ${MAX_AI_QUESTIONS}`,
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
      Array.from({ length: count }).map(() =>
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

    // Lưu vào DB trong 1 transaction: nếu 1 câu lỗi thì không để lại dữ liệu rác
    const client = await pool.connect();
    let savedQuestions;
    try {
      await client.query("BEGIN");
      savedQuestions = await Promise.all(
        questions.map(async (q) => {
          const question = q.question;
          const options = type === "trac_nghiem" ? JSON.stringify(q.options) : null;
          const correct_index = type === "trac_nghiem" ? q.correct_index - 1 : null;
          const inserted = await client.query(
            `INSERT INTO quiz_questions (quiz_id, question, options, correct_index, created_at)
             VALUES ($1, $2, $3, $4, NOW())
             RETURNING question_id`,
            [quiz_id, question, options, correct_index]
          );
          return { ...q, question_id: inserted.rows[0].question_id };
        })
      );
      await client.query("COMMIT");
    } catch (txErr) {
      await client.query("ROLLBACK");
      throw txErr;
    } finally {
      client.release();
    }

    res.status(201).json({
      message: `✅ Đã tạo thành công ${questions.length} câu hỏi từ AI`,
      topic,
      questions: savedQuestions,
    });
  } catch (err) {
    console.error("Lỗi tạo câu hỏi từ AI:", err);

    // Dịch vụ AI bên ngoài hỏng/hết credit/hết hạn mức là lỗi phía upstream,
    // không phải lỗi của API này -> trả 503 để client biết là tạm thời,
    // thay vì 500 khiến người dùng tưởng server mình hỏng.
    const upstreamStatus = err?.status || err?.response?.status;
    if (upstreamStatus === 429) {
      return res.status(503).json({
        error:
          "Dịch vụ AI tạm thời không khả dụng (hết hạn mức). Vui lòng thử lại sau hoặc dùng tạo câu hỏi thủ công.",
      });
    }
    if (upstreamStatus === 401 || upstreamStatus === 403) {
      return res.status(503).json({
        error:
          "Dịch vụ AI tạm thời không khả dụng (API key không hợp lệ). Vui lòng kiểm tra cấu hình OPENAI_API_KEY.",
      });
    }
    if (upstreamStatus >= 500 || err?.code === "ETIMEDOUT" || err?.code === "ECONNREFUSED") {
      return res.status(503).json({
        error: "Dịch vụ AI tạm thời không khả dụng. Vui lòng thử lại sau.",
      });
    }

    res.status(500).json({ error: "Lỗi khi tạo câu hỏi từ AI: " + err.message });
  }
};

module.exports = createQuestionFromAi;
