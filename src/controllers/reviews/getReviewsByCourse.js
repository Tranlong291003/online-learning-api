// controllers/reviews/getReviewsByCourse.js
const { sql, poolPromise } = require("../../config/db.config");

const getReviewsByCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const pool = await poolPromise;
    const result = await pool.request().input("courseId", sql.Int, courseId)
      .query(`
        SELECT
          r.review_id,
          r.course_id,
          r.user_uid,
          u.name            AS user_name,
          u.avatar_url      AS user_avatar_url,
          r.rating,
          r.comment,
          r.created_at,
          r.updated_at
        FROM course_reviews r
        LEFT JOIN users u
          ON r.user_uid = u.uid
        WHERE r.course_id = @courseId
        ORDER BY r.created_at DESC
      `);

    return res.status(200).json({ data: result.recordset });
  } catch (err) {
    return res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

module.exports = getReviewsByCourse;
