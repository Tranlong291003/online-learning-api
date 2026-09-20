const { pool } = require("../../config/db.config");
const { resolveActorUid } = require("../../middleware/actor");

const getAllLessons = async (req, res) => {
  const { course_id } = req.params;

  if (!course_id || isNaN(+course_id)) {
    return res.status(400).json({ error: "Tham số course_id không hợp lệ" });
  }

  // userUid chỉ dùng để đánh dấu is_completed; chỉ được xem tiến độ của chính mình
  const userUid = resolveActorUid(req, res, req.params.userUid);
  if (!userUid) return;

  try {
    const result = await pool.query(
      `SELECT
        l.lesson_id,
        l.course_id,
        l.title,
        l.video_url,
        l.video_id,
        l.video_duration,
        l.pdf_url,
        l.slide_url,
        l.content,
        l."order",
        l.created_at,
        l.updated_at,
        l.creator_uid,
        CASE WHEN lp.is_completed = true THEN 1 ELSE 0 END AS is_completed,
        u.name AS creator_name,
        u.avatar_url AS creator_avatar
      FROM lessons AS l
      LEFT JOIN lesson_progress AS lp
        ON lp.lesson_id = l.lesson_id AND lp.user_uid = $2
      LEFT JOIN users AS u
        ON l.creator_uid = u.uid
      WHERE l.course_id = $1
      ORDER BY l."order" ASC`,
      [+course_id, userUid]
    );

    if (result.rows.length === 0) {
      return res.status(200).json({
        message: "Không có bài học cho khóa học này.",
        data: [],
      });
    }

    res.status(200).json({
      message: "Lấy danh sách bài học thành công",
      data: result.rows,
    });
  } catch (err) {
    console.error("getAllLessons error:", err);
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

module.exports = getAllLessons;
