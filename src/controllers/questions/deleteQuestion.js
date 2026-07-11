// controllers/questions/deleteQuestion.js
const { deleteRows, selectRows, supabaseAdmin } = require("../../services/supabase.service");

const deleteQuestion = async (req, res) => {
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
      .select("creator_uid")
      .eq("quiz_id", question.quiz_id)
      .maybeSingle();
    if (role !== "admin" && (!quiz || quiz.creator_uid !== user_uid)) {
      return res.status(403).json({ error: "Không có quyền xóa câu hỏi này" });
    }

    const { error: delErr } = await deleteRows(
      supabaseAdmin, "quiz_questions", { question_id: Number(question_id) }
    );
    if (delErr) throw delErr;

    res.status(200).json({ message: "Xóa câu hỏi thành công" });
  } catch (err) {
    console.error("deleteQuestion error:", err);
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

module.exports = deleteQuestion;
