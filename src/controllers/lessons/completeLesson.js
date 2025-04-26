const { sql, poolPromise } = require("../../config/db.config");

const completeLesson = async (req, res) => {
  const { lesson_id } = req.params;
  const { uid } = req.body;

  if (!uid) {
    return res.status(400).json({ error: "Thiếu uid người dùng" });
  }

  try {
    const pool = await poolPromise;
    const request = new sql.Request(pool);

    request.input("lesson_id", sql.Int, lesson_id);
    request.input("user_uid", sql.NVarChar, uid);

    // Kiểm tra xem đã hoàn thành chưa
    const check = await request.query(`
      SELECT is_completed FROM lesson_progress
      WHERE lesson_id = @lesson_id AND user_uid = @user_uid
    `);

    const existing = check.recordset[0];
    if (existing?.is_completed) {
      return res.status(200).json({
        message: "Bạn đã học bài học này rồi",
        alreadyCompleted: true,
      });
    }

    // Nếu chưa hoàn thành → MERGE vào
    await request.query(`
      MERGE lesson_progress AS target
      USING (
        SELECT @lesson_id AS lesson_id, @user_uid AS user_uid
      ) AS source
      ON target.lesson_id = source.lesson_id AND target.user_uid = source.user_uid
      WHEN MATCHED THEN
        UPDATE SET is_completed = 1, completed_at = GETDATE()
      WHEN NOT MATCHED THEN
        INSERT (lesson_id, user_uid, is_completed, completed_at)
        VALUES (@lesson_id, @user_uid, 1, GETDATE());
    `);

    res.status(200).json({
      message: "Đã đánh dấu hoàn thành bài học",
      alreadyCompleted: false,
    });
  } catch (err) {
    res.status(500).json({ error: "Lỗi đánh dấu hoàn thành: " + err.message });
  }
};

module.exports = completeLesson;
