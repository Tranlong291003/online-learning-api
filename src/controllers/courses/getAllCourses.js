// controllers/courses/getAllCourses.js
// Lay danh sach khoa hoc + rating, enroll_count, lesson_count, total_duration.
// PostgREST khong ho tro GROUP BY -> query 4 bang rieng va merge o JS.
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

const getAllCourses = async (req, res) => {
  try {
    const { status, category, search } = req.query;

    const { data: courses, error } = await selectRows(
      supabaseAdmin, "courses", "*",
      { order: { col: "updated_at", ascending: false } }
    );
    if (error) throw error;
    if (!courses || !courses.length)
      return res.status(200).json({ message: "Không có khóa học", data: { pending: [], approved: [], rejected: [] }, total: 0 });

    let filtered = courses;
    if (status && status.trim() && status !== "all") filtered = filtered.filter((c) => c.status === status.trim());
    if (category && category.trim()) {
      const catId = parseInt(category, 10);
      if (!isNaN(catId) && catId !== 0) filtered = filtered.filter((c) => c.category_id === catId);
    }
    if (!filtered.length)
      return res.status(200).json({ message: "Không có khóa học", data: { pending: [], approved: [], rejected: [] }, total: 0 });

    const courseIds = filtered.map((c) => c.course_id);
    const [usersRes, catsRes, reviewsRes, enrollsRes, lessonsRes] = await Promise.all([
      supabaseAdmin.from("users").select("uid, name, avatar_url").in("uid", [...new Set(filtered.map((c) => c.instructor_uid).filter(Boolean))]),
      supabaseAdmin.from("course_categories").select("category_id, name").in("category_id", [...new Set(filtered.map((c) => c.category_id).filter(Boolean))]),
      supabaseAdmin.from("course_reviews").select("course_id, rating").in("course_id", courseIds),
      supabaseAdmin.from("enrollments").select("course_id").in("course_id", courseIds),
      supabaseAdmin.from("lessons").select("course_id, video_duration").in("course_id", courseIds),
    ]);
    const users = usersRes.data || [];
    const cats = catsRes.data || [];
    const reviews = reviewsRes.data || [];
    const enrolls = enrollsRes.data || [];
    const lessons = lessonsRes.data || [];

    const userMap = Object.fromEntries(users.map((u) => [u.uid, u]));
    const catMap = Object.fromEntries(cats.map((c) => [c.category_id, c]));

    const ratingMap = {}, enrollMap = {}, durationMap = {}, lessonCountMap = {};
    for (const r of reviews) {
      if (!ratingMap[r.course_id]) ratingMap[r.course_id] = { sum: 0, count: 0 };
      ratingMap[r.course_id].sum += r.rating;
      ratingMap[r.course_id].count += 1;
    }
    for (const e of enrolls) enrollMap[e.course_id] = (enrollMap[e.course_id] || 0) + 1;
    for (const l of lessons) {
      lessonCountMap[l.course_id] = (lessonCountMap[l.course_id] || 0) + 1;
      durationMap[l.course_id] = (durationMap[l.course_id] || 0) + parseDuration(l.video_duration);
    }

    const decorated = filtered.map((c) => {
      const r = ratingMap[c.course_id];
      const u = userMap[c.instructor_uid];
      const cat = catMap[c.category_id];
      return {
        course_id: c.course_id,
        title: c.title,
        instructor_uid: c.instructor_uid,
        category_id: c.category_id,
        price: c.price,
        level: c.level,
        discount_price: c.discount_price,
        thumbnail_url: c.thumbnail_url,
        status: c.status,
        rejection_reason: c.rejection_reason,
        updated_at: c.updated_at,
        instructor_name: u?.name,
        instructor_avatar: u?.avatar_url,
        category_name: cat?.name,
        rating: r ? +(r.sum / r.count).toFixed(2) : 0,
        review_count: r?.count || 0,
        enroll_count: enrollMap[c.course_id] || 0,
        lesson_count: lessonCountMap[c.course_id] || 0,
        total_duration: formatDuration(durationMap[c.course_id] || 0),
        discount_percent: c.discount_price && c.price
          ? Math.round(((c.price - c.discount_price) / c.price) * 100)
          : 0,
      };
    });

    let finalList = decorated;
    if (search && search.trim()) {
      const kw = search.trim().toLowerCase();
      finalList = decorated.filter((c) =>
        (c.title || "").toLowerCase().includes(kw) ||
        (c.instructor_name || "").toLowerCase().includes(kw) ||
        (c.category_name || "").toLowerCase().includes(kw)
      );
    }
    if (!finalList.length)
      return res.status(200).json({ message: "Không có khóa học", data: { pending: [], approved: [], rejected: [] }, total: 0 });

    const grouped = finalList.reduce(
      (acc, c) => { (acc[c.status || "pending"] = acc[c.status || "pending"] || []).push(c); return acc; },
      { pending: [], approved: [], rejected: [] }
    );
    res.status(200).json({ data: grouped, total: finalList.length });
  } catch (err) {
    console.error("getAllCourses error:", err);
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

module.exports = getAllCourses;

