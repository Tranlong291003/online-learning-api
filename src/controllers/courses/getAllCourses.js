const { sql, poolPromise } = require("../../config/db.config");

const getAllCourses = async (req, res) => {
  try {
    const pool = await poolPromise;
    const request = new sql.Request(pool);

    const query = `
      SELECT
        c.course_id,
        c.title,
        c.price,
        c.discount_price,
        c.thumbnail_url,
        c.status,
        c.updated_at,
        u.name AS instructor_name,
        cat.name AS category_name
      FROM courses c
      LEFT JOIN users u ON c.instructor_uid = u.uid
      LEFT JOIN course_categories cat ON c.category_id = cat.category_id
      ORDER BY c.updated_at DESC
    `;

    const result = await request.query(query);

    res.status(200).json({
      message: "Lấy danh sách khóa học thành công",
      data: result.recordset,
    });
  } catch (err) {
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

module.exports = getAllCourses;
