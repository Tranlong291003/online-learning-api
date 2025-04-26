const { sql, poolPromise } = require("../../config/db.config");

const getCourseProgressForUser = async (req, res) => {
  const { uid, course_id } = req.params;

  if (!uid || !course_id) {
    return res.status(400).json({ error: "Thiếu uid hoặc course_id" });
  }

  try {
    const pool = await poolPromise;
    const request = new sql.Request(pool);

    request.input("uid", sql.NVarChar, uid);
    request.input("course_id", sql.Int, course_id);

    // Tổng số bài học trong khóa học
    const totalLessonsResult = await request.query(`
      SELECT COUNT(*) AS total_lessons
      FROM lessons
      WHERE course_id = @course_id
    `);

    const totalLessons = totalLessonsResult.recordset[0]?.total_lessons || 0;

    // Số bài đã hoàn thành của user trong khóa học đó
    const completedLessonsResult = await request.query(`
      SELECT COUNT(*) AS completed_lessons
      FROM lesson_progress
      WHERE user_uid = @uid
      AND is_completed = 1
      AND lesson_id IN (
        SELECT lesson_id FROM lessons WHERE course_id = @course_id
      )
    `);

    const completedLessons =
      completedLessonsResult.recordset[0]?.completed_lessons || 0;

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
    res.status(500).json({
      error: "Lỗi lấy tiến độ học tập: " + err.message,
    });
  }
};

module.exports = getCourseProgressForUser;
