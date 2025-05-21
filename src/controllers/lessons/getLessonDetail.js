// controllers/getLessonDetail.js
const { sql, poolPromise } = require("../../config/db.config");

const getLessonDetail = async (req, res) => {
  const { lessonId } = req.params;

  // 1. Kiểm tra nếu lessonId hợp lệ
  if (!lessonId || isNaN(lessonId)) {
    return res.status(400).json({ error: "lessonId không hợp lệ" });
  }

  try {
    const pool = await poolPromise;
    const request = new sql.Request(pool);

    // Đưa lessonId vào parameter để truy vấn
    request.input("lessonId", sql.Int, lessonId);

    // 2. Query chi tiết bài học lấy hết các cột
    const result = await request.query(`
      SELECT
        lesson_id,
        course_id,
        title,
        video_url,
        pdf_url,
        slide_url,
        [content],
        [order],
        created_at,
        updated_at,
        creator_uid,
        video_id,
        video_duration
      FROM lessons
      WHERE lesson_id = @lessonId
    `);

    // 3. Kiểm tra nếu không có bài học nào với lessonId này
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy bài học này" });
    }

    // 4. Trả về kết quả thành công
    res.status(200).json({
      message: "Lấy chi tiết bài học thành công",
      data: result.recordset[0],
    });
  } catch (err) {
    // 5. Nếu có lỗi server xảy ra
    console.error("getLessonDetail error:", err);
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

module.exports = getLessonDetail;
