// controllers/reviews/updateReview.js
const { updateRows, selectRows, supabaseAdmin } = require("../../services/supabase.service");

const updateReview = async (req, res) => {
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
      return res.status(403).json({ error: "Không có quyền sửa đánh giá này" });
    }

    const patch = {};
    if (req.body.rating !== undefined) {
      const r = Number(req.body.rating);
      if (!Number.isInteger(r) || r < 1 || r > 5)
        return res.status(400).json({ error: "rating phải là số nguyên từ 1 đến 5" });
      patch.rating = r;
    }
    if (req.body.comment !== undefined) {
      patch.comment = req.body.comment ? String(req.body.comment).trim() : null;
    }
    if (Object.keys(patch).length === 0)
      return res.status(400).json({ error: "Không có trường nào để cập nhật" });
    patch.updated_at = new Date().toISOString();

    const { data: updated, error: updErr } = await updateRows(
      supabaseAdmin, "course_reviews", patch, { review_id: Number(review_id) }
    );
    if (updErr) throw updErr;

    res.status(200).json({
      message: "Cập nhật đánh giá thành công",
      data: updated && updated[0] ? updated[0] : null,
    });
  } catch (err) {
    console.error("updateReview error:", err);
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

module.exports = updateReview;
