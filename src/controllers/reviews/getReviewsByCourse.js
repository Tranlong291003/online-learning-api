// controllers/reviews/getReviewsByCourse.js
// Lay tat ca review cua mot khoa hoc + thong tin user.
const { supabaseAdmin } = require("../../services/supabase.service");

const getReviewsByCourse = async (req, res) => {
  try {
    const { course_id } = req.params;
    if (!course_id || isNaN(Number(course_id)))
      return res.status(400).json({ error: "course_id không hợp lệ" });

    const { data: reviews, error: rErr } = await supabaseAdmin
      .from("course_reviews")
      .select("review_id, user_uid, rating, comment, created_at, updated_at")
      .eq("course_id", Number(course_id))
      .order("created_at", { ascending: false });
    if (rErr) throw rErr;
    if (!reviews || !reviews.length)
      return res.status(200).json({ message: "Chưa có đánh giá nào", data: { reviews: [], average: 0, count: 0 } });

    const uids = [...new Set(reviews.map((r) => r.user_uid))];
    const { data: users } = await supabaseAdmin
      .from("users")
      .select("uid, name, avatar_url")
      .in("uid", uids);
    const userMap = Object.fromEntries((users || []).map((u) => [u.uid, u]));

    const total = reviews.reduce((s, r) => s + r.rating, 0);
    const average = total / reviews.length;
    const data = reviews.map((r) => ({
      ...r,
      user: userMap[r.user_uid] || { uid: r.user_uid, name: "Người dùng", avatar_url: null },
    }));

    res.status(200).json({
      message: "Danh sách đánh giá",
      data: { reviews: data, average: Math.round(average * 10) / 10, count: reviews.length },
    });
  } catch (err) {
    console.error("getReviewsByCourse error:", err);
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

module.exports = getReviewsByCourse;
