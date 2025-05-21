// controllers/getAllLessons.js
const { sql, poolPromise } = require("../../config/db.config");

const getAllLessons = async (req, res) => {
  const { course_id, userUid } = req.params;

  // Validate input
  if (!course_id || isNaN(+course_id)) {
    return res.status(400).json({ error: "Tham số course_id không hợp lệ" });
  }
  if (!userUid) {
    return res.status(400).json({ error: "Tham số userUid bắt buộc" });
  }

  try {
    const pool = await poolPromise;
    const request = new sql.Request(pool);

    request.input("courseId", sql.Int, +course_id);
    request.input("userUid", sql.NVarChar(50), userUid);

    // Lấy tất cả lessons với đầy đủ thông tin
    const result = await request.query(`
      SELECT
        l.lesson_id,
        l.course_id,
        l.title,
        l.video_url,
        l.video_id,
        l.video_duration,
        l.pdf_url,
        l.slide_url,
        l.content,
        l.[order],
        l.created_at,
        l.updated_at,
        l.creator_uid,
        CASE
          WHEN lp.is_completed = 1 THEN 1
          ELSE 0
        END AS is_completed,
        u.name AS creator_name,
        u.avatar_url AS creator_avatar
      FROM lessons AS l
      LEFT JOIN lesson_progress AS lp
        ON lp.lesson_id = l.lesson_id
       AND lp.user_uid = @userUid
      LEFT JOIN users AS u
        ON l.creator_uid = u.uid
      WHERE l.course_id = @courseId
      ORDER BY l.[order] ASC
    `);

    // Trả về kết quả mặc dù không có bài học nào
    if (result.recordset.length === 0) {
      return res.status(200).json({
        message: "Không có bài học cho khóa học này.",
        data: [],
      });
    }

    res.status(200).json({
      message: "Lấy danh sách bài học thành công",
      data: result.recordset,
    });
  } catch (err) {
    console.error("getAllLessons error:", err);
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

module.exports = getAllLessons;
