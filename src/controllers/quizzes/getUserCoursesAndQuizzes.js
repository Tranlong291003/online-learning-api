// controllers/quizzes/getUserCoursesAndQuizzes.js
// User da enroll cac khoa hoc nao + quiz tuong ung.
const { supabaseAdmin } = require("../../services/supabase.service");

const getUserCoursesAndQuizzes = async (req, res) => {
  try {
    const user_uid = req.supabaseUser?.authUser?.id;
    if (!user_uid) return res.status(401).json({ error: "Chưa đăng nhập" });

    const { data: enrollments, error: enErr } = await supabaseAdmin
      .from("enrollments")
      .select("course_id, enrolled_at")
      .eq("user_uid", user_uid);
    if (enErr) throw enErr;
    if (!enrollments || !enrollments.length)
      return res.status(200).json({ message: "Chưa đăng ký khóa học nào", data: [] });

    const courseIds = enrollments.map((e) => e.course_id);
    const [coursesRes, quizzesRes] = await Promise.all([
      supabaseAdmin.from("courses")
        .select("course_id, title, thumbnail_url, status")
        .in("course_id", courseIds),
      supabaseAdmin.from("quizzes")
        .select("quiz_id, course_id, title, type, time_limit, attempt_limit")
        .in("course_id", courseIds),
    ]);
    if (coursesRes.error) throw coursesRes.error;
    if (quizzesRes.error) throw quizzesRes.error;

    const courses = coursesRes.data || [];
    const quizzes = quizzesRes.data || [];
    const qMap = {};
    for (const q of quizzes) {
      if (!qMap[q.course_id]) qMap[q.course_id] = [];
      qMap[q.course_id].push(q);
    }
    const data = courses.map((c) => ({ ...c, quizzes: qMap[c.course_id] || [] }));
    res.status(200).json({ message: "Khóa học và bài kiểm tra của bạn", data });
  } catch (err) {
    console.error("getUserCoursesAndQuizzes error:", err);
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

module.exports = getUserCoursesAndQuizzes;
