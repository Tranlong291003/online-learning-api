// controllers/courseCategories/getAllCourses.js
const { sql, poolPromise } = require("../../config/db.config");

const getAllCourses = async (req, res) => {
  try {
    const pool = await poolPromise; // Sử dụng poolPromise để đảm bảo kết nối sẵn sàng
    const request = new sql.Request(pool);

    // Truy vấn SQL để lấy danh sách khóa học
    const query = `
      SELECT
        course_id,
        courses.title,
        courses.price,
        courses.discount_price,
        courses.thumbnail_url,
        courses.updated_at,
        users.name AS instructor_name,
        course_categories.name AS category_name
      FROM courses
      LEFT JOIN users ON courses.instructor_id = users.user_id
      LEFT JOIN course_categories ON courses.category_id = course_categories.category_id
    `;

    const result = await request.query(query); // Thực thi truy vấn

    // Trả về danh sách khóa học
    res.status(200).json({
      message: "Lấy danh sách khóa học thành công",
      data: result.recordset, // Dữ liệu khóa học trả về từ query
    });
  } catch (err) {
    // Nếu có lỗi, trả về mã lỗi 500 và thông báo lỗi
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

module.exports = getAllCourses;
