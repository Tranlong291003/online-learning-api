// controllers/bookmarks/getBookmarksByUser.js
const { sql, poolPromise } = require("../../config/db.config");

const getBookmarksByUser = async (req, res) => {
  try {
    // Lấy user_uid từ đường dẫn param
    const { user_uid } = req.params;
    if (!user_uid) {
      return res.status(400).json({ error: "user_uid là bắt buộc" });
    }

    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("user_uid", sql.NVarChar, user_uid)
      .query(
        `SELECT
           b.bookmark_id,
           b.course_id,
           c.title           AS course_title,
           c.thumbnail_url   AS course_thumbnail,
           b.created_at
         FROM bookmarks b
         JOIN courses c
           ON b.course_id = c.course_id
         WHERE b.user_uid = @user_uid
         ORDER BY b.created_at DESC`
      );

    return res.status(200).json({ data: result.recordset });
  } catch (err) {
    return res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

module.exports = getBookmarksByUser;
