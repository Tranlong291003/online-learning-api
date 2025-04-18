const { sql, poolPromise } = require("../../config/db.config");

const completeLesson = async (req, res) => {
  const { lesson_id } = req.params; // ID bài học từ URL
  const { user_id } = req.body; // ID người dùng từ body

  if (!user_id) {
    return res.status(400).json({ error: "Thiếu user_id" });
  }

  try {
    const pool = await poolPromise; // Sử dụng poolPromise để kết nối
    const request = new sql.Request(pool);

    // Khai báo các tham số
    request.input("lesson_id", sql.Int, lesson_id);
    request.input("user_id", sql.Int, user_id);

    // Câu lệnh MERGE sẽ kiểm tra xem người dùng đã hoàn thành bài học này chưa
    await request.query(`
      MERGE lesson_progress AS target
      USING (SELECT @lesson_id AS lesson_id, @user_id AS user_id) AS source
      ON target.lesson_id = source.lesson_id AND target.user_id = source.user_id
      WHEN MATCHED THEN
        UPDATE SET is_completed = 1, completed_at = GETDATE()  -- Đánh dấu là hoàn thành
      WHEN NOT MATCHED THEN
        INSERT (lesson_id, user_id, is_completed, completed_at)
        VALUES (@lesson_id, @user_id, 1, GETDATE());  -- Thêm bài học mới nếu chưa có trong bảng
    `);

    res.status(200).json({ message: "Đã đánh dấu hoàn thành bài học" });
  } catch (err) {
    res.status(500).json({ error: "Lỗi đánh dấu hoàn thành: " + err.message });
  }
};

module.exports = completeLesson;
