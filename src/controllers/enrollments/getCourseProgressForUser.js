const { pool } = require("../../config/db.config");
const { sendServerError } = require("../../utils/errorResponse");
const { parsePositiveInt } = require("../../utils/parseId");
const { resolveActorUid } = require("../../middleware/actor");

const getCourseProgressForUser = async (req, res) => {
  const payload = {
    ...(req.query || {}),
    ...(req.body || {}),
  };
  // parsePositiveInt chặn cả trường hợp thiếu và trường hợp sai định dạng
  // ("abc", "1.5"), vốn làm PostgreSQL ném lỗi và trả 500.
  const courseId = parsePositiveInt(payload.courseId ?? payload.course_id);

  if (!courseId) {
    return res.status(400).json({ error: "Thiếu courseId hoặc courseId không hợp lệ" });
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
    // Dùng sendServerError: nối thẳng err.message vào response sẽ rò chi tiết
    // CSDL (tên bảng/cột/ràng buộc) ra client, kể cả ở production.
    return sendServerError(res, "Lỗi lấy tiến độ học tập", err);
  }
};

module.exports = getCourseProgressForUser;
