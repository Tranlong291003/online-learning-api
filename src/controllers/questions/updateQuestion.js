// controllers/questions/updateQuestion.js
const { updateRows, selectRows, supabaseAdmin } = require("../../services/supabase.service");

const updateQuestion = async (req, res) => {
  try {
    const { question_id } = req.params;
    if (!question_id || isNaN(Number(question_id)))
      return res.status(400).json({ error: "question_id không hợp lệ" });

    const user_uid = req.supabaseUser?.authUser?.id;
    const role = req.supabaseUser?.profile?.role;
    if (!user_uid) return res.status(401).json({ error: "Chưa đăng nhập" });

    const { data: question, error: findErr } = await selectRows(
      supabaseAdmin, "quiz_questions", "question_id,quiz_id",
      { eq: { question_id: Number(question_id) }, single: true }
    );
    if (findErr) throw findErr;
    if (!question) return res.status(404).json({ error: "Không tìm thấy câu hỏi" });

    const { data: quiz } = await supabaseAdmin
      .from("quizzes")
      .select("creator_uid, type")
      .eq("quiz_id", question.quiz_id)
      .maybeSingle();
    if (role !== "admin" && (!quiz || quiz.creator_uid !== user_uid)) {
      return res.status(403).json({ error: "Không có quyền sửa câu hỏi này" });
    }

    const patch = {};
    if (req.body.question !== undefined) {
      if (!req.body.question || !String(req.body.question).trim())
        return res.status(400).json({ error: "Nội dung câu hỏi không được để trống" });
      patch.question = String(req.body.question).trim();
    }
    if (req.body.options !== undefined) {
      if (!Array.isArray(req.body.options))
        return res.status(400).json({ error: "options phải là mảng chuỗi" });
      patch.options = JSON.stringify(req.body.options);
    }
    if (req.body.correct_index !== undefined) {
      const ci = Number(req.body.correct_index);
      if (!Number.isInteger(ci) || ci < 0)
        return res.status(400).json({ error: "correct_index phải là số nguyên >= 0" });
      patch.correct_index = ci;
    }
    if (req.body.expected_keywords !== undefined) {
      patch.expected_keywords = req.body.expected_keywords
        ? String(req.body.expected_keywords).trim() : null;
    }
    if (Object.keys(patch).length === 0)
      return res.status(400).json({ error: "Không có trường nào để cập nhật" });
    patch.updated_at = new Date().toISOString();

    const { data: updated, error: updErr } = await updateRows(
      supabaseAdmin, "quiz_questions", patch, { question_id: Number(question_id) }
    );
    if (updErr) throw updErr;

    res.status(200).json({
      message: "Cập nhật câu hỏi thành công",
      data: updated && updated[0] ? updated[0] : null,
    });
  } catch (err) {
    console.error("updateQuestion error:", err);
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

module.exports = updateQuestion;
