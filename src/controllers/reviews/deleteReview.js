// controllers/reviews/deleteReview.js
const { deleteRows, selectRows, supabaseAdmin } = require("../../services/supabase.service");

const deleteReview = async (req, res) => {
  try {
    const { review_id } = req.params;
    if (!review_id || isNaN(Number(review_id)))
      return res.status(400).json({ error: "review_id không hợp lệ" });

    const user_uid = req.supabaseUser?.authUser?.id;
    const role = req.supabaseUser?.profile?.role;
    if (!user_uid) return res.status(401).json({ error: "Chưa đăng nhập" });

    const { data: review, error: findErr } = await selectRows(
      supabaseAdmin, "course_reviews", "review_id,user_uid",
      { eq: { review_id: Number(review_id) }, single: true }
    );
    if (findErr) throw findErr;
    if (!review) return res.status(404).json({ error: "Không tìm thấy đánh giá" });
    if (role !== "admin" && review.user_uid !== user_uid) {
      return res.status(403).json({ error: "Không có quyền xóa đánh giá này" });
    }

    const { error: delErr } = await deleteRows(
      supabaseAdmin, "course_reviews", { review_id: Number(review_id) }
    );
    if (delErr) throw delErr;

    res.status(200).json({ message: "Xóa đánh giá thành công" });
  } catch (err) {
    console.error("deleteReview error:", err);
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

module.exports = deleteReview;
