// controllers/questions/createQuestionFromAi.js
// Tao cau hoi tu AI. Cung cap cau truc body: { quiz_id, prompt }.
// AI tra ve JSON { question, options, correct_index } -> luu vao quiz_questions.
const { insertRows, selectRows, supabaseAdmin } = require("../../services/supabase.service");
const { generateAiQuiz } = require("../../services/ai.service");

const createQuestionFromAi = async (req, res) => {
  try {
    const { quiz_id, prompt } = req.body;
    const user_uid = req.supabaseUser?.authUser?.id;

    if (!user_uid) return res.status(401).json({ error: "Chưa đăng nhập" });
    if (!quiz_id || isNaN(Number(quiz_id)))
      return res.status(400).json({ error: "quiz_id không hợp lệ" });
    if (!prompt || !prompt.trim())
      return res.status(400).json({ error: "Vui lòng nhập prompt" });

    const { data: quiz, error: qErr } = await selectRows(
      supabaseAdmin, "quizzes", "quiz_id,type,creator_uid",
      { eq: { quiz_id: Number(quiz_id) }, single: true }
    );
    if (qErr) throw qErr;
    if (!quiz) return res.status(404).json({ error: "Không tìm thấy bài kiểm tra" });

    const role = req.supabaseUser?.profile?.role;
    if (role !== "admin" && quiz.creator_uid !== user_uid) {
      return res.status(403).json({ error: "Không có quyền thêm câu hỏi" });
    }

    const ai = await generateAiQuiz(prompt, quiz.type);
    if (!ai || !ai.question)
      return res.status(502).json({ error: "AI không trả về câu hỏi hợp lệ" });

    const insertPayload = {
      quiz_id: Number(quiz_id),
      question: String(ai.question).trim(),
      options: null,
      correct_index: null,
      expected_keywords: null,
    };

    if (quiz.type === "trac_nghiem") {
      if (!Array.isArray(ai.options) || ai.options.length < 2) {
        return res.status(502).json({ error: "AI không trả về lựa chọn hợp lệ" });
      }
      const ci = Number(ai.correct_index);
      if (!Number.isInteger(ci) || ci < 0 || ci >= ai.options.length) {
        return res.status(502).json({ error: "AI trả về correct_index không hợp lệ" });
      }
      insertPayload.options = JSON.stringify(ai.options);
      insertPayload.correct_index = ci;
    } else if (ai.expected_keywords) {
      insertPayload.expected_keywords = String(ai.expected_keywords).trim();
    }

    const { data: inserted, error: insErr } = await insertRows(
      supabaseAdmin, "quiz_questions", insertPayload
    );
    if (insErr) throw insErr;

    res.status(201).json({
      message: "Tạo câu hỏi từ AI thành công",
      data: inserted && inserted[0] ? inserted[0] : null,
    });
  } catch (err) {
    console.error("createQuestionFromAi error:", err);
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

module.exports = createQuestionFromAi;
