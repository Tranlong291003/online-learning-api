// controllers/enrollments/getCourseProgressForUser.js
// Tinh progress chi tiet cua user cho mot khoa hoc (lesson_progress).
const { supabaseAdmin } = require("../../services/supabase.service");

const getCourseProgressForUser = async (req, res) => {
  try {
    const { course_id } = req.params;
    const user_uid = req.supabaseUser?.authUser?.id;

    if (!user_uid) return res.status(401).json({ error: "Chưa đăng nhập" });
    if (!course_id || isNaN(Number(course_id)))
      return res.status(400).json({ error: "course_id không hợp lệ" });

    const { count: totalCount } = await supabaseAdmin
      .from("lessons")
      .select("lesson_id", { count: "exact", head: true })
      .eq("course_id", Number(course_id));

    const { data: completedRows, error: progErr } = await supabaseAdmin
      .from("lesson_progress")
      .select("lesson_id, completed_at")
      .eq("user_uid", user_uid)
      .eq("course_id", Number(course_id))
      .eq("is_completed", true);
    if (progErr) throw progErr;

    const total = totalCount || 0;
    const done = (completedRows || []).length;
    const progress = total > 0 ? Math.floor((done / total) * 100) : 0;
    const completed_lesson_ids = (completedRows || []).map((r) => r.lesson_id);

    res.status(200).json({
      message: "Lấy tiến độ khóa học",
      data: {
        course_id: Number(course_id),
        total_lessons: total,
        completed_lessons: done,
        progress_percent: progress,
        completed_lesson_ids,
      },
    });
  } catch (err) {
    console.error("getCourseProgressForUser error:", err);
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

module.exports = getCourseProgressForUser;
