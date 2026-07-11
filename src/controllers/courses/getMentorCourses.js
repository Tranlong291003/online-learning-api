// controllers/courses/getMentorCourses.js
// Lay cac khoa hoc cua 1 mentor + rating, enroll_count, lesson_count, total_duration
const { selectRows, supabaseAdmin } = require("../../services/supabase.service");

const parseDuration = (hms) => {
  if (!hms) return 0;
  const [h = 0, m = 0, s = 0] = hms.split(":").map(Number);
  return h * 3600 + m * 60 + s;
};
const formatDuration = (sec) => {
  if (!sec) return "00:00:00";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const getMentorCourses = async (req, res) => {
  try {
    const { instructor_uid } = req.params;
    if (!instructor_uid) return res.status(400).json({ error: "Thiếu instructor_uid" });

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("uid, name, avatar_url, bio")
      .eq("uid", instructor_uid)
      .maybeSingle();
    if (!user) return res.status(404).json({ error: "Không tìm thấy người dùng" });

    const { data: courses, error } = await selectRows(
      supabaseAdmin, "courses", "*",
      { eq: { instructor_uid }, order: { col: "updated_at", ascending: false } }
    );
    if (error) throw error;
    if (!courses || !courses.length)
      return res.status(200).json({ message: "Không có khóa học nào của mentor này", data: { pending: [], approved: [], rejected: [] }, total: 0 });

    const courseIds = courses.map((c) => c.course_id);
    const catIds = [...new Set(courses.map((c) => c.category_id).filter(Boolean))];
    const [catsRes, reviewsRes, enrollsRes, lessonsRes] = await Promise.all([
      supabaseAdmin.from("course_categories").select("category_id, name").in("category_id", catIds),
      supabaseAdmin.from("course_reviews").select("course_id, rating").in("course_id", courseIds),
      supabaseAdmin.from("enrollments").select("course_id").in("course_id", courseIds),
      supabaseAdmin.from("lessons").select("course_id, video_duration").in("course_id", courseIds),
    ]);
    const cats = catsRes.data || [];
    const reviews = reviewsRes.data || [];
    const enrolls = enrollsRes.data || [];
    const lessons = lessonsRes.data || [];

    const catMap = Object.fromEntries(cats.map((c) => [c.category_id, c]));
    const ratingMap = {}, enrollMap = {}, lessonMap = {}, durationMap = {};
    for (const r of reviews) {
      if (!ratingMap[r.course_id]) ratingMap[r.course_id] = { sum: 0, count: 0 };
      ratingMap[r.course_id].sum += r.rating;
      ratingMap[r.course_id].count += 1;
    }
    for (const e of enrolls) enrollMap[e.course_id] = (enrollMap[e.course_id] || 0) + 1;
    for (const l of lessons) {
      lessonMap[l.course_id] = (lessonMap[l.course_id] || 0) + 1;
      durationMap[l.course_id] = (durationMap[l.course_id] || 0) + parseDuration(l.video_duration);
    }

    const decorated = courses.map((c) => {
      const r = ratingMap[c.course_id];
      const cat = catMap[c.category_id];
      return {
        ...c,
        instructor_name: user.name,
        instructor_avatar: user.avatar_url,
        instructor_bio: user.bio,
        category_name: cat?.name,
        rating: r ? +(r.sum / r.count).toFixed(2) : 0,
        review_count: r?.count || 0,
        enroll_count: enrollMap[c.course_id] || 0,
        lesson_count: lessonMap[c.course_id] || 0,
        total_duration: formatDuration(durationMap[c.course_id] || 0),
        discount_percent: c.discount_price && c.price
          ? Math.round(((c.price - c.discount_price) / c.price) * 100)
          : 0,
      };
    });

    const grouped = decorated.reduce(
      (acc, c) => { (acc[c.status || "pending"] = acc[c.status || "pending"] || []).push(c); return acc; },
      { pending: [], approved: [], rejected: [] }
    );
    res.status(200).json({ data: grouped, total: decorated.length });
  } catch (err) {
    console.error("getMentorCourses error:", err);
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

module.exports = getMentorCourses;

