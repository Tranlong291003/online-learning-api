const { sql, poolConnect, pool } = require("../config/db.config");

exports.getCourseProgressForUser = async (req, res) => {
  const { user_id, course_id } = req.params;

  try {
    const pool = await poolConnect; // Đảm bảo kết nối đã được thiết lập
    const request = new sql.Request(pool);

    // Khai báo tham số `user_id` và `course_id`
    request.input("user_id", sql.Int, user_id);
    request.input("course_id", sql.Int, course_id);

    // Truy vấn tổng số bài học trong khóa học
    const totalLessonsResult = await request.query(`
      SELECT COUNT(*) AS total_lessons
      FROM lessons
      WHERE course_id = @course_id
    `);

    const totalLessons = totalLessonsResult.recordset[0].total_lessons;

    // Truy vấn số bài học đã hoàn thành của người dùng
    const completedLessonsResult = await request.query(`
      SELECT COUNT(*) AS completed_lessons
      FROM lesson_progress
      WHERE user_id = @user_id
      AND lesson_id IN (SELECT lesson_id FROM lessons WHERE course_id = @course_id)
      AND is_completed = 1
    `);

    const completedLessons =
      completedLessonsResult.recordset[0].completed_lessons;

    // Tính phần trăm tiến độ
    const progressPercent =
      totalLessons > 0
        ? Math.floor((completedLessons / totalLessons) * 100)
        : 0;

    res.status(200).json({
      message: "Lấy tiến độ học tập thành công",
      data: {
        total_lessons: totalLessons,
        completed_lessons: completedLessons,
        progress_percent: progressPercent,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Lỗi lấy tiến độ học tập: " + err.message });
  }
};
