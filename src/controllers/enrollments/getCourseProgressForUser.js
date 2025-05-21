// src/controllers/progress/getCourseProgressForUser.js
const { sql, poolPromise } = require("../../config/db.config");

const getCourseProgressForUser = async (req, res) => {
  /* Lấy từ body thay vì params */
  const { userUid, courseId } = req.body;

  if (!userUid || !courseId) {
    return res
      .status(400)
      .json({ error: "Thiếu userUid hoặc courseId trong body JSON" });
  }

  try {
    const pool = await poolPromise;
    const rq = new sql.Request(pool);

    rq.input("uid", sql.NVarChar, userUid);
    rq.input("course_id", sql.Int, Number(courseId));

    /* 1. Tổng số bài học của khoá */
    const total = await rq.query(`
      SELECT COUNT(*) AS total_lessons
      FROM lessons
      WHERE course_id = @course_id
    `);
    const totalLessons = total.recordset[0]?.total_lessons ?? 0;

    /* 2. Số bài đã hoàn thành (không cần JOIN) */
    const done = await rq.query(`
      SELECT COUNT(*) AS completed_lessons
      FROM lesson_progress
      WHERE user_uid     = @uid
        AND course_id    = @course_id
        AND is_completed = 1
    `);
    const completedLessons = done.recordset[0]?.completed_lessons ?? 0;

    /* 3. Tính % tiến độ */
    const progressPercent =
      totalLessons > 0
        ? Math.floor((completedLessons / totalLessons) * 100)
        : 0;

    return res.status(200).json({
      message: "Lấy tiến độ học tập thành công",
      data: {
        total_lessons: totalLessons,
        completed_lessons: completedLessons,
        progress_percent: progressPercent,
      },
    });
  } catch (err) {
    return res
      .status(500)
      .json({ error: "Lỗi lấy tiến độ học tập: " + err.message });
  }
};

module.exports = getCourseProgressForUser;
