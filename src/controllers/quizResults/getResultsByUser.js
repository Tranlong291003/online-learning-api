// controllers/quizResults/getResultsByUser.js
const { supabaseAdmin } = require("../../services/supabase.service");

const getResultsByUser = async (req, res) => {
  try {
    const user_uid = req.supabaseUser?.authUser?.id;
    if (!user_uid) return res.status(401).json({ error: "Chưa đăng nhập" });

    const targetUid = req.query.uid || user_uid;
    if (targetUid !== user_uid) {
      const role = req.supabaseUser?.profile?.role;
      if (role !== "admin") return res.status(403).json({ error: "Không có quyền xem" });
    }

    const { data: results, error } = await supabaseAdmin
      .from("quiz_results")
      .select("result_id, quiz_id, score, status, submitted_at, graded_at")
      .eq("user_uid", targetUid)
      .order("submitted_at", { ascending: false });
    if (error) throw error;
    if (!results || !results.length)
      return res.status(200).json({ message: "Chưa có kết quả", data: [] });

    const quizIds = [...new Set(results.map((r) => r.quiz_id))];
    const { data: quizzes } = await supabaseAdmin
      .from("quizzes")
      .select("quiz_id, course_id, title, type")
      .in("quiz_id", quizIds);
    const qMap = Object.fromEntries((quizzes || []).map((q) => [q.quiz_id, q]));

    const data = results.map((r) => ({ ...r, quiz: qMap[r.quiz_id] || null }));
    res.status(200).json({ message: "Danh sách kết quả", data });
  } catch (err) {
    console.error("getResultsByUser error:", err);
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

module.exports = getResultsByUser;
