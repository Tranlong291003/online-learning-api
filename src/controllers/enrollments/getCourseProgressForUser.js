const { pool } = require("../../config/db.config");
const { resolveActorUid } = require("../../middleware/actor");

const getCourseProgressForUser = async (req, res) => {
  const payload = {
    ...(req.query || {}),
    ...(req.body || {}),
  };
  const courseId = payload.courseId || payload.course_id;

  if (!courseId) {
    return res.status(400).json({ error: "Thiếu courseId" });
  }

  // Lấy uid từ token; chỉ admin mới được xem tiến độ của người khác
  const userUid = resolveActorUid(
    req,
    res,
    payload.userUid || payload.user_uid || payload.uid
  );
  if (!userUid) return;

  try {
    // Tổng số bài học
    const total = await pool.query(
      "SELECT COUNT(*) AS total_lessons FROM lessons WHERE course_id = $1",
      [Number(courseId)]
    );
    const totalLessons = parseInt(total.rows[0]?.total_lessons) ?? 0;

    // Số bài hoàn thành
    const done = await pool.query(
      `SELECT COUNT(*) AS completed_lessons
       FROM lesson_progress
       WHERE user_uid = $1 AND course_id = $2 AND is_completed = true`,
      [userUid, Number(courseId)]
    );
    const completedLessons = parseInt(done.rows[0]?.completed_lessons) ?? 0;

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
