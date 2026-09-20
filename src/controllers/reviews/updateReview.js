const { pool } = require("../../config/db.config");
const { resolveActorUid } = require("../../middleware/actor");

const updateReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { rating, comment } = req.body;

    if (rating == null && comment == null) {
      return res.status(400).json({ error: "Không có dữ liệu để cập nhật" });
    }

    if (rating != null && (!Number.isInteger(Number(rating)) || Number(rating) < 1 || Number(rating) > 5)) {
      return res.status(400).json({ error: "rating phải là số nguyên từ 1 đến 5" });
    }

    // Lấy uid từ token; chỉ admin mới được sửa review thay người khác
    const user_uid = resolveActorUid(req, res, req.body.user_uid);
    if (!user_uid) return;

    // Kiểm tra tồn tại và chủ sở hữu
    const chk = await pool.query(
      "SELECT user_uid FROM course_reviews WHERE review_id = $1",
      [reviewId]
    );
    if (chk.rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy review" });
    }
    if (chk.rows[0].user_uid !== user_uid) {
      return res.status(403).json({ error: "Bạn không có quyền cập nhật review này" });
    }

    // Dynamic update
    const sets = [];
    const values = [];
    let paramIndex = 1;

    if (rating != null) {
      sets.push(`rating = $${paramIndex++}`);
      values.push(rating);
    }
    if (comment != null) {
      sets.push(`comment = $${paramIndex++}`);
      values.push(comment);
    }
    sets.push("updated_at = NOW()");
    values.push(reviewId);

    const sqlUpdate = `UPDATE course_reviews SET ${sets.join(", ")} WHERE review_id = $${paramIndex}`;
    await pool.query(sqlUpdate, values);

    return res.status(200).json({ message: "✅ Cập nhật thành công" });
  } catch (err) {
    return res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

module.exports = updateReview;
