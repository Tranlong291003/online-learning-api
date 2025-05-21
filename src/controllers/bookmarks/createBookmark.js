// controllers/bookmarks/createBookmark.js
const { sql, poolPromise } = require("../../config/db.config");

const createBookmark = async (req, res) => {
  try {
    // Nhận các trường từ body không có underscore
    const { courseId, userUid } = req.body;
    if (!courseId || !userUid) {
      return res.status(400).json({ error: "courseId và userUid là bắt buộc" });
    }

    const pool = await poolPromise;
    const request = pool
      .request()
      .input("course_id", sql.Int, courseId) // chuyển sang @course_id
      .input("user_uid", sql.NVarChar, userUid); // chuyển sang @user_uid

    // Kiểm xem đã bookmark chưa
    const exists = await request.query(`
      SELECT 1
      FROM bookmarks
      WHERE course_id = @course_id AND user_uid = @user_uid
    `);
    if (exists.recordset.length > 0) {
      return res
        .status(400)
        .json({ error: "Bạn đã bookmark khóa học này rồi" });
    }

    // Thêm bookmark
    const result = await request.query(`
      INSERT INTO bookmarks (course_id, user_uid, created_at)
      OUTPUT INSERTED.bookmark_id
      VALUES (@course_id, @user_uid, GETDATE())
    `);

    const bookmarkId = result.recordset[0].bookmark_id;
    return res.status(201).json({ data: { bookmark_id: bookmarkId } });
  } catch (err) {
    return res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

module.exports = createBookmark;
