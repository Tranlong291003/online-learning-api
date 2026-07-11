// controllers/enrollments/getCoursesByUser.js
// Lay danh sach khoa hoc da dang ky cua user + progress tinh tu lesson_progress.
const { supabaseAdmin } = require("../../services/supabase.service");

const parseDuration = (hms) => {
  if (!hms) return 0;
  const [h = 0, m = 0, s = 0] = hms.split(":").map(Number);
  return h * 3600 + m * 60 + s;
};
const formatDuration = (sec) => {
  if (!sec) return "0 phút";
  if (sec < 3600) return `${Math.floor(sec / 60)} phút`;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h} Giờ ${m} phút`;
};

const getCoursesByUser = async (req, res) => {
  try {
    const uid = req.params.uid || req.query.uid || req.supabaseUser?.authUser?.id;
    if (!uid) return res.status(400).json({ error: "Thiếu uid người dùng" });

    // Cho phep user chi xem cua chinh minh (tru admin)
    if (req.supabaseUser) {
      const self = req.supabaseUser.authUser?.id;
      const role = req.supabaseUser.profile?.role;
      if (self !== uid && role !== "admin") {
        return res.status(403).json({ error: "Không có quyền xem danh sách này" });
      }
    }

    const { data: enrollments, error: enrollErr } = await supabaseAdmin
      .from("enrollments")
      .select("enrollment_id, course_id, enrolled_at")
      .eq("user_uid", uid);
    if (enrollErr) throw enrollErr;
    if (!enrollments || !enrollments.length) {
      return res.status(200).json({
        message: "Chưa đăng ký khóa học nào",
        data: { in_progress: [], completed: [] },
      });
    }

    const courseIds = enrollments.map((e) => e.course_id);
    const [coursesRes, lessonsRes, progressRes] = await Promise.all([
      supabaseAdmin.from("courses")
        .select("course_id, title, thumbnail_url, instructor_uid, category_id, price, discount_price, level, status")
        .in("course_id", courseIds),
      supabaseAdmin.from("lessons")
        .select("course_id, video_duration")
        .in("course_id", courseIds),
      supabaseAdmin.from("lesson_progress")
        .select("course_id, lesson_id")
        .eq("user_uid", uid)
        .eq("is_completed", true)
        .in("course_id", courseIds),
    ]);
    if (coursesRes.error) throw coursesRes.error;
    if (lessonsRes.error) throw lessonsRes.error;
    if (progressRes.error) throw progressRes.error;

    const courses = coursesRes.data || [];
    const lessons = lessonsRes.data || [];
    const progresses = progressRes.data || [];

    const courseMap = Object.fromEntries(courses.map((c) => [c.course_id, c]));
    const lessonCountMap = {}, durationMap = {};
    for (const l of lessons) {
      lessonCountMap[l.course_id] = (lessonCountMap[l.course_id] || 0) + 1;
      durationMap[l.course_id] = (durationMap[l.course_id] || 0) + parseDuration(l.video_duration);
    }
    const completedSetMap = {};
    for (const p of progresses) {
      if (!completedSetMap[p.course_id]) completedSetMap[p.course_id] = new Set();
      completedSetMap[p.course_id].add(p.lesson_id);
    }

    const inProgress = [], completed = [];
    for (const e of enrollments) {
      const course = courseMap[e.course_id];
      if (!course) continue;
      const totalLessons = lessonCountMap[e.course_id] || 0;
      const completedSet = completedSetMap[e.course_id];
      const completedLessons = completedSet ? completedSet.size : 0;
      const progressPercent = totalLessons > 0
        ? Math.floor((completedLessons / totalLessons) * 100)
        : 0;
      const row = {
        course_id: course.course_id,
        title: course.title,
        thumbnail_url: course.thumbnail_url,
        instructor_uid: course.instructor_uid,
        category_id: course.category_id,
        price: course.price,
        discount_price: course.discount_price,
        level: course.level,
        status: course.status,
        total_lessons: totalLessons,
        completed_lessons: completedLessons,
        progress_percent: progressPercent,
        total_duration: formatDuration(durationMap[e.course_id] || 0),
        enrolled_at: e.enrolled_at,
      };
      if (progressPercent === 100 && totalLessons > 0) completed.push(row);
      else inProgress.push(row);
    }

    res.status(200).json({
      message: "Khóa học đã đăng ký kèm tiến độ",
      data: { in_progress: inProgress, completed },
    });
  } catch (err) {
    console.error("getCoursesByUser error:", err);
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

module.exports = getCoursesByUser;
