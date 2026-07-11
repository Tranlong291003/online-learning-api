// controllers/quizzes/deleteQuiz.js
const { deleteRows, selectRows, supabaseAdmin } = require("../../services/supabase.service");

const deleteQuiz = async (req, res) => {
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
      return res.status(403).json({ error: "Không có quyền xóa bài kiểm tra này" });
    }

    const { error: delErr } = await deleteRows(
      supabaseAdmin, "quizzes", { quiz_id: Number(quiz_id) }
    );
    if (delErr) throw delErr;

    res.status(200).json({ message: "Xóa bài kiểm tra thành công" });
  } catch (err) {
    console.error("deleteQuiz error:", err);
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

module.exports = deleteQuiz;
