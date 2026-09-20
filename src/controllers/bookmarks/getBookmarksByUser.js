const { pool } = require("../../config/db.config");
const { resolveActorUid } = require("../../middleware/actor");

const getBookmarksByUser = async (req, res) => {
  try {
    // Chỉ được xem bookmark của chính mình (admin xem được của người khác)
    const user_uid = resolveActorUid(req, res, req.params.user_uid);
    if (!user_uid) return;

    const result = await pool.query(
      `SELECT
         b.bookmark_id,
         b.course_id,
         c.title           AS course_title,
         c.thumbnail_url   AS course_thumbnail,
         b.created_at
       FROM bookmarks b
       JOIN courses c ON b.course_id = c.course_id
       WHERE b.user_uid = $1
       ORDER BY b.created_at DESC`,
      [user_uid]
    );

    return res.status(200).json({ data: result.rows });
  } catch (err) {
    return res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

module.exports = getBookmarksByUser;
