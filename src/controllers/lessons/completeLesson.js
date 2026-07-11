// controllers/lessons/completeLesson.js
// User danh dau hoan thanh bai hoc. Insert vao lesson_progress (UNIQUE user+course+lesson).
const { insertRows, supabaseAdmin } = require("../../services/supabase.service");

const completeLesson = async (req, res) => {
  try {
    const { courseId, lessonId } = req.body;
    const user_uid = req.supabaseUser?.authUser?.id;

    if (!user_uid) return res.status(401).json({ error: "Chưa đăng nhập" });
    if (!courseId || !lessonId) {
      return res.status(400).json({ error: "Thiếu courseId hoặc lessonId" });
    }
    if (!Number.isInteger(Number(courseId)) || !Number.isInteger(Number(lessonId))) {
      return res.status(400).json({ error: "courseId và lessonId phải là số" });
    }

    const cid = Number(courseId);
    const lid = Number(lessonId);

    // Kiem tra lesson thuoc course
    const { data: lessonRow } = await supabaseAdmin
      .from("lessons")
      .select("lesson_id")
      .eq("lesson_id", lid)
      .eq("course_id", cid)
      .maybeSingle();
    if (!lessonRow) return res.status(404).json({ error: "Bài học không thuộc khóa học này" });

    // Kiem tra user da enroll
    const { data: enrolls } = await supabaseAdmin
      .from("enrollments")
      .select("enrollment_id")
      .eq("user_uid", user_uid)
      .eq("course_id", cid)
      .limit(1);
    if (!enrolls || !enrolls.length) {
      return res.status(403).json({ error: "Chưa đăng ký khóa học" });
    }

    const { error: insErr } = await insertRows(
      supabaseAdmin, "lesson_progress", {
        user_uid,
        course_id: cid,
        lesson_id: lid,
        is_completed: true,
        completed_at: new Date().toISOString(),
      }
    );
    const alreadyCompleted = insErr && insErr.code === "23505";
    if (insErr && !alreadyCompleted) throw insErr;

    const { count: totalCount } = await supabaseAdmin
      .from("lessons")
      .select("lesson_id", { count: "exact", head: true })
      .eq("course_id", cid);
    const { count: completedCount } = await supabaseAdmin
      .from("lesson_progress")
      .select("progress_id", { count: "exact", head: true })
      .eq("user_uid", user_uid)
      .eq("course_id", cid)
      .eq("is_completed", true);
    const total = totalCount || 0;
    const done = completedCount || 0;
    const progress = total > 0 ? Math.floor((done / total) * 100) : 0;

    const message = alreadyCompleted
      ? "Bạn đã hoàn thành bài học này rồi"
      : "Đánh dấu hoàn thành bài học thành công";

    res.status(200).json({
      message,
      data: { lesson_id: lid, course_id: cid, progress, total_lessons: total, completed_lessons: done },
    });
  } catch (err) {
    console.error("completeLesson error:", err);
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

module.exports = completeLesson;
