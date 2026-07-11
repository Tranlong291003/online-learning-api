// controllers/appStats.controller.js
// Thong ke dashboard: admin (tong quan) hoac mentor (khoa hoc cua minh).
const { supabaseAdmin } = require("../services/supabase.service");

const getStats = async (req, res) => {
  try {
    const uid = req.supabaseUser.authUser.id;
    const role = req.supabaseUser.profile?.role;
    if (role !== "admin" && role !== "mentor") {
      return res.status(403).json({ error: "Ban khong co quyen xem thong ke nay" });
    }

    if (role === "admin") {
      const [c, u, q, r, e, b] = await Promise.all([
        supabaseAdmin.from("courses").select("course_id", { count: "exact", head: true }),
        supabaseAdmin.from("users").select("id", { count: "exact", head: true }),
        supabaseAdmin.from("quizzes").select("quiz_id", { count: "exact", head: true }),
        supabaseAdmin.from("course_reviews").select("review_id", { count: "exact", head: true }),
        supabaseAdmin.from("enrollments").select("enrollment_id", { count: "exact", head: true }),
        supabaseAdmin.from("bookmarks").select("bookmark_id", { count: "exact", head: true }),
      ]);
      return res.status(200).json({
        role: "admin",
        total_courses: c.count || 0,
        total_users: u.count || 0,
        total_quizzes: q.count || 0,
        total_reviews: r.count || 0,
        total_enrollments: e.count || 0,
        total_bookmarks: b.count || 0,
      });
    }

    // Mentor: chi tinh trong cac khoa hoc cua ho
    const { data: courses } = await supabaseAdmin
      .from("courses")
      .select("course_id")
      .eq("instructor_uid", uid);
    const courseIds = (courses || []).map((c) => c.course_id);
    if (!courseIds.length)
      return res.status(200).json({
        role: "mentor",
        total_courses: 0,
        total_lessons: 0,
        total_students: 0,
        total_reviews: 0,
        avg_rating: 0,
      });

    const [lessonsRes, reviewsRes, enrollsRes] = await Promise.all([
      supabaseAdmin.from("lessons").select("lesson_id", { count: "exact", head: true }).in("course_id", courseIds),
      supabaseAdmin.from("course_reviews").select("rating").in("course_id", courseIds),
      supabaseAdmin.from("enrollments").select("user_uid", { count: "exact", head: true }).in("course_id", courseIds),
    ]);
    const ratings = (reviewsRes.data || []).map((r) => r.rating).filter(Number.isInteger);
    const avg = ratings.length ? Math.round((ratings.reduce((s, x) => s + x, 0) / ratings.length) * 10) / 10 : 0;
    return res.status(200).json({
      role: "mentor",
      total_courses: courseIds.length,
      total_lessons: lessonsRes.count || 0,
      total_students: enrollsRes.count || 0,
      total_reviews: ratings.length,
      avg_rating: avg,
    });
  } catch (err) {
    console.error("appStats error:", err);
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getStats };
