const { pool } = require("../../config/db.config");
const { sendServerError } = require("../../utils/errorResponse");
const { parsePositiveInt } = require("../../utils/parseId");

const getReviewsByCourse = async (req, res) => {
  const courseId = parsePositiveInt(req.params.courseId);

  if (!courseId) {
    return res.status(400).json({ error: "courseId không hợp lệ" });
  }

  try {

    const result = await pool.query(
      `SELECT
        r.review_id,
        r.course_id,
        r.user_uid,
        u.name AS user_name,
        u.avatar_url AS user_avatar_url,
        r.rating,
        r.comment,
        r.created_at,
        r.updated_at
      FROM course_reviews r
      LEFT JOIN users u ON r.user_uid = u.uid
      WHERE r.course_id = $1
      ORDER BY r.created_at DESC`,
      [courseId]
    );

    return res.status(200).json({ data: result.rows });
  } catch (err) {
    return sendServerError(res, "Lỗi server", err);
  }
};

module.exports = getReviewsByCourse;
