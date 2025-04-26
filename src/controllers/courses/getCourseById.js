const { sql, poolPromise } = require("../../config/db.config");

const getCourseById = async (req, res) => {
  const { course_id } = req.params;

  try {
    const pool = await poolPromise;
    const request = new sql.Request(pool);

    request.input("course_id", sql.Int, course_id);

    const result = await request.query(`
      SELECT
        c.course_id,
        c.title,
        c.description,
        c.level,
        c.price,
        c.discount_price,
        c.status,
        c.approved_at,
        c.language,
        c.tags,
        c.thumbnail_url,
        c.created_at,
        c.updated_at,
        c.category_id,
        c.instructor_uid,
        u.name AS instructor_name,
        u.bio AS instructor_bio, -- ✅ Lấy thêm mô tả giảng viên
        cat.name AS category_name
      FROM courses c
      LEFT JOIN users u ON c.instructor_uid = u.uid
      LEFT JOIN course_categories cat ON c.category_id = cat.category_id
      WHERE c.course_id = @course_id
    `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy khóa học" });
    }

    res.status(200).json({
      message: "Lấy chi tiết khóa học thành công",
      data: result.recordset[0],
    });
  } catch (err) {
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

module.exports = getCourseById;
