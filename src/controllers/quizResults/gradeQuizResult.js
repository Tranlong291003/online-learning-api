// controllers/quizResults/gradeQuizResult.js
// Mentor cham bai tu luan: cap nhat score, status='da_cham', graded_by, graded_at.
// graded_by FK -> users.id (bigserial), lay tu profile.
const { updateRows, selectRows, supabaseAdmin } = require("../../services/supabase.service");

const gradeQuizResult = async (req, res) => {
  try {
    const { result_id } = req.params;
    const { score, explanation } = req.body;
    const user_uid = req.supabaseUser?.authUser?.id;
    const role = req.supabaseUser?.profile?.role;

    if (!user_uid) return res.status(401).json({ error: "Chưa đăng nhập" });
    if (role !== "mentor" && role !== "admin")
      return res.status(403).json({ error: "Chỉ giảng viên hoặc admin mới được chấm bài" });
    if (!result_id || isNaN(Number(result_id)))
      return res.status(400).json({ error: "result_id không hợp lệ" });
    const s = Number(score);
    if (!Number.isFinite(s) || s < 0 || s > 10)
      return res.status(400).json({ error: "score phải là số từ 0 đến 10" });

    const { data: result, error: findErr } = await selectRows(
      supabaseAdmin, "quiz_results", "result_id,quiz_id,user_uid,status",
      { eq: { result_id: Number(result_id) }, single: true }
    );
    if (findErr) throw findErr;
    if (!result) return res.status(404).json({ error: "Không tìm thấy kết quả" });

    if (role === "mentor") {
      // Mentor chi duoc cham bai thuoc quiz cua minh
      const { data: quiz } = await supabaseAdmin
        .from("quizzes")
        .select("creator_uid")
        .eq("quiz_id", result.quiz_id)
        .maybeSingle();
      if (!quiz || quiz.creator_uid !== user_uid)
        return res.status(403).json({ error: "Bạn không phải giảng viên phụ trách bài này" });
    }

    // Lay users.id (int) de gan graded_by
    const { data: grader } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("uid", user_uid)
      .maybeSingle();
    if (!grader) return res.status(404).json({ error: "Không tìm thấy hồ sơ người chấm" });

    const { data: updated, error: updErr } = await updateRows(
      supabaseAdmin, "quiz_results", {
        score: s,
        status: "da_cham",
        explanation: explanation ? String(explanation).trim() : null,
        graded_by: grader.id,
        graded_at: new Date().toISOString(),
      },
      { result_id: Number(result_id) }
    );
    if (updErr) throw updErr;

    res.status(200).json({
      message: "Chấm bài thành công",
      data: updated && updated[0] ? updated[0] : null,
    });
  } catch (err) {
    console.error("gradeQuizResult error:", err);
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

module.exports = gradeQuizResult;
