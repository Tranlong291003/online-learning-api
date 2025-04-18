const { sql, poolConnect, pool } = require("../../config/db.config");

const getAllCourses = async (req, res) => {
  try {
    await poolConnect;
    const request = new sql.Request(pool);

    const query = `
      SELECT
        course_id,
        courses.title,
        courses.price,
        courses.discount_price,
        courses.thumbnail_url,
        courses.updated_at,
        users.display_name AS instructor_name,
        course_categories.name AS category_name
      FROM courses
      LEFT JOIN users ON courses.instructor_id = users.user_id
      LEFT JOIN course_categories ON courses.category_id = course_categories.category_id
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
