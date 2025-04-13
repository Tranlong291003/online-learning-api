const { sql, poolConnect, pool } = require("../../config/db.config");

const getAllLessons = async (req, res) => {
  const { course_id } = req.params;

  try {
    await poolConnect;
    const request = new sql.Request(pool);
    request.input("courseId", sql.Int, course_id);

    const result = await request.query(`
      SELECT * FROM lessons
      WHERE course_id = @courseId
      ORDER BY [order] ASC
    `);

    if (result.recordset.length === 0) {
      return res
        .status(404)
        .json({ error: "Không tìm thấy bài học cho khóa học này" });
    }

    res.status(200).json({
      message: "Lấy danh sách bài học thành công",
      data: result.recordset,
    });
  } catch (err) {
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};
module.exports = getAllLessons;
