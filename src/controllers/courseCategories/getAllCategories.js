const { pool } = require("../../config/db.config");
const { sendServerError } = require("../../utils/errorResponse");

const getCategoriesWithCourseCount = async (req, res) => {
  try {
    const query = `
      SELECT
        cc.category_id,
        cc.name,
        cc.description,
        cc.created_at,
        cc.updated_at,
        cc.icon,
        COUNT(c.course_id) AS course_count
      FROM course_categories cc
      LEFT JOIN courses c ON cc.category_id = c.category_id
      GROUP BY
        cc.category_id,
        cc.name,
        cc.description,
        cc.created_at,
        cc.updated_at,
        cc.icon
    `;

    const result = await pool.query(query);

    res.status(200).json({
      message: "Lấy danh mục cùng số lượng khóa học thành công",
      data: result.rows,
    });
  } catch (err) {
    console.error("Error fetching categories with course count:", err);
    sendServerError(res, "Lỗi server", err);
  }
};

module.exports = getCategoriesWithCourseCount;
