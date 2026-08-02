const { pool } = require("../../config/db.config");

const createBookmark = async (req, res) => {
  try {
    const { courseId, userUid } = req.body;
    if (!courseId || !userUid) {
      return res.status(400).json({ error: "courseId và userUid là bắt buộc" });
    }

    // Kiểm tra đã bookmark chưa
    const exists = await pool.query(
      "SELECT 1 FROM bookmarks WHERE course_id = $1 AND user_uid = $2",
      [courseId, userUid]
    );

    if (exists.rows.length > 0) {
      return res.status(400).json({ error: "Bạn đã bookmark khóa học này rồi" });
    }

    // Thêm bookmark
    const result = await pool.query(
      `INSERT INTO bookmarks (course_id, user_uid, created_at)
       VALUES ($1, $2, NOW())
       RETURNING bookmark_id`,
      [courseId, userUid]
    );

    const bookmarkId = result.rows[0].bookmark_id;
    return res.status(201).json({ data: { bookmark_id: bookmarkId } });
  } catch (err) {
    return res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

module.exports = createBookmark;
