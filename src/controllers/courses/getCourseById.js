// controllers/courses/getCourseById.js
const { selectRows, supabaseAdmin } = require("../../services/supabase.service");

const getCourseById = async (req, res) => {
  try {
    const { course_id } = req.params;

    const { data: course, error } = await selectRows(
      supabaseAdmin, "courses", "*",
      { eq: { course_id: Number(course_id) }, single: true }
    );
    if (error) throw error;
    if (!course) return res.status(404).json({ error: "Không tìm thấy khóa học" });

    const { data: instructor } = await supabaseAdmin
      .from("users")
      .select("uid, name, avatar_url, bio")
      .eq("uid", course.instructor_uid)
      .maybeSingle();
    const { data: cat } = course.category_id
      ? await supabaseAdmin
          .from("course_categories")
          .select("category_id, name")
          .eq("category_id", course.category_id)
          .maybeSingle()
      : { data: null };

    const [reviewsRes, enrollsRes, lessonsRes] = await Promise.all([
      supabaseAdmin.from("course_reviews").select("rating, user_uid").eq("course_id", course.course_id),
      supabaseAdmin.from("enrollments").select("user_uid").eq("course_id", course.course_id),
      supabaseAdmin.from("lessons").select("lesson_id, updated_at, video_duration").eq("course_id", course.course_id),
    ]);
    const reviews = reviewsRes.data || [];
    const enrolls = enrollsRes.data || [];
    const lessons = lessonsRes.data || [];

    const ratingSum = reviews.reduce((a, r) => a + r.rating, 0);
    const ratingCount = reviews.length;
    const avg_rating = ratingCount ? +(ratingSum / ratingCount).toFixed(1) : 0;

    const total_seconds = lessons.reduce((a, l) => {
      if (!l.video_duration) return a;
      const [h = 0, m = 0, s = 0] = l.video_duration.split(":").map(Number);
      return a + h * 3600 + m * 60 + s;
    }, 0);
    const total_video_duration = total_seconds
      ? `${String(Math.floor(total_seconds / 3600)).padStart(2, "0")}:${String(Math.floor((total_seconds % 3600) / 60)).padStart(2, "0")}:${String(total_seconds % 60).padStart(2, "0")}`
      : "00:00:00";

    const last_lesson_update = lessons.reduce(
      (max, l) => (l.updated_at && (!max || l.updated_at > max)) ? l.updated_at : max,
      null
    );
    const last_update = last_lesson_update && last_lesson_update > course.updated_at
      ? last_lesson_update
      : course.updated_at;

    const discount_percent = course.discount_price && course.price
      ? Math.round(((course.price - course.discount_price) / course.price) * 100)
      : 0;

    res.status(200).json({
      message: "Lấy chi tiết khóa học thành công",
      data: {
        ...course,
        category_name: cat?.name,
        instructor_name: instructor?.name,
        instructor_avatar_url: instructor?.avatar_url,
        instructor_bio: instructor?.bio,
        avg_rating,
        review_count: ratingCount,
        enrollment_count: enrolls.length,
        total_video_duration,
        last_lesson_update,
        last_update,
        lesson_count: lessons.length,
        discount_percent,
      },
    });
  } catch (err) {
    console.error("getCourseById error:", err);
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

module.exports = getCourseById;

