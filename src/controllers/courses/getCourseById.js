const { sql, poolConnect, pool } = require("../../config/db.config");
const getCourseById = async (req, res) => {
  const { course_id } = req.params;
  try {
    await poolConnect;
    const request = new sql.Request(pool);
    request.input("course_id", sql.Int, course_id);

    const result = await request.query(`
      SELECT
        courses.course_id,
        courses.title,
        courses.description,
        courses.level,
        courses.price,
        courses.discount_price,
        courses.status,
        courses.approved_at,
        courses.language,
        courses.tags,
        courses.thumbnail_url,
        courses.created_at,
        courses.updated_at,
        courses.category_id,
        courses.instructor_id,
        users.display_name AS instructor_name,
        course_categories.name AS category_name
      FROM courses
      LEFT JOIN users ON courses.instructor_id = users.user_id
      LEFT JOIN course_categories ON courses.category_id = course_categories.category_id
      WHERE courses.course_id = @course_id
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
