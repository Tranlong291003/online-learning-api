// src/controllers/lesson/completeLesson.js
const { sql, poolPromise } = require("../../config/db.config");

const completeLesson = async (req, res) => {
  const { userUid, courseId, lessonId } = req.body;

  // 1. Validate input
  if (!userUid || !courseId || !lessonId) {
    return res
      .status(400)
      .json({ error: "Thiếu userUid, courseId hoặc lessonId" });
  }
  if (!Number.isInteger(courseId) || !Number.isInteger(lessonId)) {
    return res.status(400).json({ error: "courseId và lessonId phải là số" });
  }

  try {
    const pool = await poolPromise;
    const rq = new sql.Request(pool);

    rq.input("user_uid", sql.NVarChar, userUid);
    rq.input("course_id", sql.Int, courseId);
    rq.input("lesson_id", sql.Int, lessonId);

    /* 2. Kiểm tra lesson thuộc course */
    const lessonCheck = await rq.query(`
      SELECT TOP 1 1
      FROM lessons
      WHERE lesson_id = @lesson_id
        AND course_id = @course_id
    `);
    if (!lessonCheck.recordset.length) {
      return res
        .status(404)
        .json({ error: "Bài học không thuộc khóa học này" });
    }

    /* 3. Tuỳ chọn: kiểm tra user đã ghi danh (nếu có bảng enrollments) */
    const enroll = await rq.query(`
      SELECT 1 FROM enrollments
      WHERE user_uid=@user_uid AND course_id=@course_id
    `);
    if (!enroll.recordset.length) {
      return res.status(403).json({ error: "Chưa ghi danh khóa học" });
    }

    /* 4. Upsert trong transaction */
    const trans = new sql.Transaction(pool);
    await trans.begin();

    const trRq = new sql.Request(trans);
    trRq.input("user_uid", sql.NVarChar, userUid);
    trRq.input("course_id", sql.Int, courseId);
    trRq.input("lesson_id", sql.Int, lessonId);

    const mergeResult = await trRq.query(`
      MERGE lesson_progress AS tgt
      USING (SELECT @user_uid AS user_uid,
                    @course_id AS course_id,
                    @lesson_id AS lesson_id) AS src
      ON  tgt.user_uid  = src.user_uid
      AND tgt.course_id = src.course_id
      AND tgt.lesson_id = src.lesson_id
      WHEN MATCHED THEN
        UPDATE SET is_completed = 1, completed_at = GETDATE()
      WHEN NOT MATCHED THEN
        INSERT (user_uid, course_id, lesson_id, is_completed, completed_at)
        VALUES (@user_uid, @course_id, @lesson_id, 1, GETDATE())
      OUTPUT
        $action AS action;
    `);

    await trans.commit();

    const action = mergeResult.recordset[0]?.action || "UNKNOWN";
    let message = "Đã đánh dấu hoàn thành bài học";
    if (action === "UPDATE") message = "Cập nhật trạng thái hoàn thành";
    if (action === "INSERT") message = "Hoàn thành bài học (lần đầu)";
    if (action === "UPDATE" && mergeResult.rowsAffected[0] === 0) {
      // trường hợp đã completed trước đó
      message = "Bạn đã học bài này rồi";
    }

    return res.status(200).json({
      status: action.toLowerCase(), // insert | update
      message,
    });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ error: "Lỗi đánh dấu hoàn thành: " + err.message });
  }
};

module.exports = completeLesson;
