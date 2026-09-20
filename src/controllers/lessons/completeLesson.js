const { pool } = require("../../config/db.config");
const { resolveActorUid } = require("../../middleware/actor");

const completeLesson = async (req, res) => {
  const body = req.body || {};
  // Nhận cả camelCase lẫn snake_case: các endpoint khác trong API dùng snake_case
  // nên FE rất dễ gửi course_id/lesson_id.
  const courseId = body.courseId ?? body.course_id;
  const lessonId = body.lessonId ?? body.lesson_id;

  if (!courseId || !lessonId) {
    return res.status(400).json({ error: "Thiếu courseId hoặc lessonId" });
  }
  if (!Number.isInteger(courseId) || !Number.isInteger(lessonId)) {
    return res.status(400).json({ error: "courseId và lessonId phải là số" });
  }

  // Lấy uid từ token; chỉ admin mới được đánh dấu thay người khác
  const userUid = resolveActorUid(req, res, req.body.userUid || req.body.uid);
  if (!userUid) return;

  let client;

  try {
    client = await pool.connect();

    // Kiểm tra lesson thuộc course
    const lessonCheck = await client.query(
      "SELECT 1 FROM lessons WHERE lesson_id = $1 AND course_id = $2 LIMIT 1",
      [lessonId, courseId]
    );
    if (!lessonCheck.rows.length) {
      return res.status(404).json({ error: "Bài học không thuộc khóa học này" });
    }

    // Kiểm tra enrollment
    const enroll = await client.query(
      "SELECT 1 FROM enrollments WHERE user_uid = $1 AND course_id = $2",
      [userUid, courseId]
    );
    if (!enroll.rows.length) {
      return res.status(403).json({ error: "Chưa ghi danh khóa học" });
    }

    await client.query("BEGIN");

    // Upsert với INSERT ON CONFLICT (PostgreSQL)
    const upsertResult = await client.query(
      `INSERT INTO lesson_progress (user_uid, course_id, lesson_id, is_completed, completed_at)
       VALUES ($1, $2, $3, true, NOW())
       ON CONFLICT (user_uid, course_id, lesson_id)
       DO UPDATE SET is_completed = true, completed_at = NOW()
       RETURNING
         CASE WHEN xmax = 0 THEN 'INSERT' ELSE 'UPDATE' END AS action`,
      [userUid, courseId, lessonId]
    );

    await client.query("COMMIT");

    const action = upsertResult.rows[0]?.action || "UNKNOWN";
    let message = "Đã đánh dấu hoàn thành bài học";
    if (action === "UPDATE") message = "Cập nhật trạng thái hoàn thành";
    if (action === "INSERT") message = "Hoàn thành bài học (lần đầu)";

    return res.status(200).json({
      status: action.toLowerCase(),
      message,
    });
  } catch (err) {
    // Chỉ ROLLBACK khi đã thực sự mở transaction; nếu lỗi xảy ra trước BEGIN
    // (ví dụ client.connect() fail) thì ROLLBACK sẽ ném lỗi thứ hai che mất lỗi gốc.
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch {
        /* bỏ qua: transaction chưa mở */
      }
    }
    console.error(err);
    return res.status(500).json({ error: "Lỗi đánh dấu hoàn thành: " + err.message });
  } finally {
    if (client) client.release();
  }
};

module.exports = completeLesson;
