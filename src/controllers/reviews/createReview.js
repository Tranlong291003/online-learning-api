// controllers/reviews/createReview.js
// User danh gia khoa hoc. UNIQUE (user_uid, course_id) -> 23505 neu da review.
const { insertRows, supabaseAdmin } = require("../../services/supabase.service");

const createReview = async (req, res) => {
  try {
    const { course_id, rating, comment } = req.body;
    const user_uid = req.supabaseUser?.authUser?.id;

    if (!user_uid) return res.status(401).json({ error: "Chưa đăng nhập" });
    if (!course_id || isNaN(Number(course_id)))
      return res.status(400).json({ error: "course_id không hợp lệ" });
    const r = Number(rating);
    if (!Number.isInteger(r) || r < 1 || r > 5)
      return res.status(400).json({ error: "rating phải là số nguyên từ 1 đến 5" });

    // Kiem tra user da enroll
    const { data: enrolled } = await supabaseAdmin
      .from("enrollments")
      .select("enrollment_id")
      .eq("user_uid", user_uid)
      .eq("course_id", Number(course_id))
      .limit(1);
    if (!enrolled || !enrolled.length)
      return res.status(403).json({ error: "Cần đăng ký khóa học trước khi đánh giá" });

    const { data: inserted, error: insErr } = await insertRows(
      supabaseAdmin, "course_reviews", {
        user_uid,
        course_id: Number(course_id),
        rating: r,
        comment: comment ? String(comment).trim() : null,
      }
    );
    if (insErr) {
      if (insErr.code === "23505") {
        return res.status(409).json({ error: "Bạn đã đánh giá khóa học này rồi. Vui lòng dùng chức năng cập nhật." });
      }
      throw insErr;
    }

    res.status(201).json({
      message: "Đánh giá khóa học thành công",
      data: inserted && inserted[0] ? inserted[0] : null,
    });
  } catch (err) {
    console.error("createReview error:", err);
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

module.exports = createReview;
