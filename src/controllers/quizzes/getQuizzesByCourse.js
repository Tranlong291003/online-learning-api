const { sql, poolPromise } = require("../../config/db.config");

const getQuizzesByCourse = async (req, res) => {
  const { course_id } = req.params;

  if (!course_id) {
    return res.status(400).json({ error: "Thiếu course_id" });
  }

  try {
    const pool = await poolPromise;
    const request = new sql.Request(pool);
    request.input("course_id", sql.Int, course_id);

    const result = await request.query(`
      SELECT
        quiz_id,
        title,
        description,
        type,
        time_limit,
        attempt_limit,
        creator_uid,
        created_at,
        updated_at
      FROM quizzes
      WHERE course_id = @course_id
    `);

    if (result.recordset.length === 0) {
      return res.status(404).json({
        error: "Không tìm thấy bài kiểm tra cho khóa học này",
      });
    }

    res.status(200).json({
      message: "📋 Danh sách bài kiểm tra của khóa học",
      data: result.recordset,
    });
  } catch (err) {
    res.status(500).json({
      error: "Lỗi khi lấy danh sách bài kiểm tra: " + err.message,
    });
  }
};

module.exports = getQuizzesByCourse;
