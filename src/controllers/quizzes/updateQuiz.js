// controllers/quizzes/updateQuiz.js
const { updateRows, selectRows, supabaseAdmin } = require("../../services/supabase.service");

const updateQuiz = async (req, res) => {
  try {
    const { quiz_id } = req.params;
    if (!quiz_id || isNaN(Number(quiz_id)))
      return res.status(400).json({ error: "quiz_id không hợp lệ" });

    const user_uid = req.supabaseUser?.authUser?.id;
    const role = req.supabaseUser?.profile?.role;
    if (!user_uid) return res.status(401).json({ error: "Chưa đăng nhập" });

    const { data: quiz, error: findErr } = await selectRows(
      supabaseAdmin, "quizzes", "quiz_id,creator_uid",
      { eq: { quiz_id: Number(quiz_id) }, single: true }
    );
    if (findErr) throw findErr;
    if (!quiz) return res.status(404).json({ error: "Không tìm thấy bài kiểm tra" });
    if (role !== "admin" && quiz.creator_uid !== user_uid) {
      return res.status(403).json({ error: "Không có quyền sửa bài kiểm tra này" });
    }

    const allowed = ["title", "description", "type", "time_limit", "attempt_limit"];
    const patch = {};
    for (const k of allowed) if (req.body[k] !== undefined) patch[k] = req.body[k];
    if (patch.title !== undefined) {
      if (!patch.title || !patch.title.trim())
        return res.status(400).json({ error: "Tiêu đề không được để trống" });
      patch.title = patch.title.trim();
    }
    if (patch.type !== undefined && !["trac_nghiem", "tu_luan"].includes(patch.type)) {
      return res.status(400).json({ error: "type không hợp lệ" });
    }
    if (Object.keys(patch).length === 0)
      return res.status(400).json({ error: "Không có trường nào để cập nhật" });
    patch.updated_at = new Date().toISOString();

    const { data: updated, error: updErr } = await updateRows(
      supabaseAdmin, "quizzes", patch, { quiz_id: Number(quiz_id) }
    );
    if (updErr) throw updErr;

    res.status(200).json({
      message: "Cập nhật bài kiểm tra thành công",
      data: updated && updated[0] ? updated[0] : null,
    });
  } catch (err) {
    console.error("updateQuiz error:", err);
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

module.exports = updateQuiz;
