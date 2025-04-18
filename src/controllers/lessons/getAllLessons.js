const { sql, poolPromise } = require("../../config/db.config");

const getAllLessons = async (req, res) => {
  const { course_id } = req.params;

  try {
    // Kết nối vào database sử dụng poolPromise
    const pool = await poolPromise;
    const request = new sql.Request(pool);

    // Cung cấp tham số course_id vào câu truy vấn
    request.input("courseId", sql.Int, course_id);

    // Thực hiện truy vấn lấy danh sách bài học cho khóa học
    const result = await request.query(`
      SELECT * FROM lessons
      WHERE course_id = @courseId
      ORDER BY [order] ASC
    `);

    // Kiểm tra nếu không có bài học nào cho khóa học
    if (result.recordset.length === 0) {
      return res
        .status(404)
        .json({ error: "Không tìm thấy bài học cho khóa học này" });
    }

    // Trả về danh sách bài học nếu tìm thấy
    res.status(200).json({
      message: "Lấy danh sách bài học thành công",
      data: result.recordset,
    });
  } catch (err) {
    // Nếu có lỗi xảy ra, trả về lỗi server
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

module.exports = getAllLessons;
