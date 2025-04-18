// controllers/courseCategories/getCourseById.js
const { sql, poolPromise } = require("../../config/db.config");

const getCourseById = async (req, res) => {
  const { course_id } = req.params; // Lấy course_id từ params

  try {
    const pool = await poolPromise; // Sử dụng poolPromise để đảm bảo kết nối sẵn sàng
    const request = new sql.Request(pool);

    // Truyền course_id vào truy vấn
    request.input("course_id", sql.Int, course_id);

    // Truy vấn SQL để lấy chi tiết khóa học
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
        users.name AS instructor_name,
        course_categories.name AS category_name
      FROM courses
      LEFT JOIN users ON courses.instructor_id = users.user_id
      LEFT JOIN course_categories ON courses.category_id = course_categories.category_id
      WHERE courses.course_id = @course_id
    `);

    // Kiểm tra nếu không tìm thấy khóa học
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy khóa học" });
    }

    // Trả về thông tin khóa học
    res.status(200).json({
      message: "Lấy chi tiết khóa học thành công",
      data: result.recordset[0], // Lấy khóa học đầu tiên từ kết quả (nếu có)
    });
  } catch (err) {
    // Nếu có lỗi, trả về mã lỗi 500 và thông báo lỗi
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

module.exports = getCourseById;
