const { pool } = require("../../config/db.config");
const { sendServerError } = require("../../utils/errorResponse");

const getLessonDetail = async (req, res) => {
  const { lessonId } = req.params;

  if (!lessonId || isNaN(lessonId)) {
    return res.status(400).json({ error: "lessonId không hợp lệ" });
  }

  try {
    const result = await pool.query(
      `SELECT
        lesson_id,
        course_id,
        title,
        video_url,
        pdf_url,
        slide_url,
        content,
        "order",
        created_at,
        updated_at,
        creator_uid,
        video_id,
        video_duration
      FROM lessons
      WHERE lesson_id = $1`,
      [lessonId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy bài học này" });
    }

    res.status(200).json({
      message: "Lấy chi tiết bài học thành công",
      data: result.rows[0],
    });
  } catch (err) {
    console.error("getLessonDetail error:", err);
    sendServerError(res, "Lỗi server", err);
  }
};

module.exports = getLessonDetail;
