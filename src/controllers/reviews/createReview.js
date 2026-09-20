const { pool } = require("../../config/db.config");
const { resolveActorUid } = require("../../middleware/actor");

const createReview = async (req, res) => {
  try {
    const { course_id, rating, comment } = req.body;
    if (!course_id || rating == null) {
      return res
        .status(400)
        .json({ error: "course_id và rating không được bỏ trống" });
    }

    if (!Number.isInteger(Number(rating)) || Number(rating) < 1 || Number(rating) > 5) {
      return res.status(400).json({ error: "rating phải là số nguyên từ 1 đến 5" });
    }

    // Lấy uid từ token; chỉ admin mới được đánh giá thay người khác
    const user_uid = resolveActorUid(req, res, req.body.user_uid);
    if (!user_uid) return;

    // Kiểm tra đã review chưa
    const check = await pool.query(
      "SELECT 1 FROM course_reviews WHERE course_id = $1 AND user_uid = $2",
      [course_id, user_uid]
    );
    if (check.rows.length > 0) {
      return res.status(400).json({ error: "Bạn đã review khóa học này rồi" });
    }

    // Thêm review
    const result = await pool.query(
      `INSERT INTO course_reviews (course_id, user_uid, rating, comment, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING review_id`,
      [course_id, user_uid, rating, comment || null]
    );

    const newId = result.rows[0].review_id;
    return res.status(201).json({ data: { review_id: newId } });
  } catch (err) {
    return res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

module.exports = createReview;
