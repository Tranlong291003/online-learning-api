const { sql, poolPromise } = require("../../config/db.config");

const getCoursesByUser = async (req, res) => {
  try {
    const { uid } = req.params; // Lấy UID từ URL

    if (!uid) {
      return res.status(400).json({ error: "Thiếu uid người dùng" });
    }

    const pool = await poolPromise;
    const request = new sql.Request(pool);
    request.input("uid", sql.NVarChar, uid);

    const result = await request.query(`
      SELECT
        e.course_id,
        e.enrolled_at,
        c.title,
        c.thumbnail_url,
        c.language,
        c.status
      FROM enrollments e
      JOIN courses c ON e.course_id = c.course_id
      WHERE e.user_uid = @uid
    `);

    res.status(200).json({
      message: "📚 Danh sách khóa học đã đăng ký",
      data: result.recordset,
    });
  } catch (err) {
    res.status(500).json({ error: "Lỗi truy vấn: " + err.message });
  }
};

module.exports = getCoursesByUser;
