const { pool } = require("../../config/db.config");
const { resolveActorUid } = require("../../middleware/actor");

const getCoursesByUser = async (req, res) => {
  // Chỉ được xem khóa học đã đăng ký của chính mình (admin xem được của người khác)
  const uid = resolveActorUid(req, res, req.params.uid);
  if (!uid) return;

  try {
    const result = await pool.query(
      `WITH lesson_stats AS (
        SELECT course_id,
               COUNT(*) AS total_lessons,
               SUM(
                 CASE
                   WHEN video_duration ~ '^[0-9]{2}:[0-9]{2}:[0-9]{2}$'
                     THEN CAST(SUBSTRING(video_duration, 1, 2) AS INT) * 3600 +
                          CAST(SUBSTRING(video_duration, 4, 2) AS INT) * 60 +
                          CAST(SUBSTRING(video_duration, 7, 2) AS INT)
                   WHEN video_duration ~ '^[0-9]{2}:[0-9]{2}$'
                     THEN CAST(SUBSTRING(video_duration, 1, 2) AS INT) * 60 +
                          CAST(SUBSTRING(video_duration, 4, 2) AS INT)
                   ELSE 0
                 END
               ) AS total_seconds
        FROM lessons
        GROUP BY course_id
      ),
      completed_cnt AS (
        SELECT course_id, COUNT(*) AS completed_lessons
        FROM lesson_progress
        WHERE user_uid = $1 AND is_completed = true
        GROUP BY course_id
      )
      SELECT
        c.course_id,
        c.title,
        c.thumbnail_url,
        COALESCE(ls.total_lessons, 0)     AS total_lessons,
        COALESCE(cc.completed_lessons, 0) AS completed_lessons,
        CASE
          WHEN COALESCE(ls.total_lessons,0)=0
            THEN 0
          ELSE FLOOR(COALESCE(cc.completed_lessons,0)*100.0/ls.total_lessons)
        END                             AS progress_percent,
        CASE
          WHEN COALESCE(ls.total_seconds,0) < 3600
            THEN CONCAT(COALESCE(ls.total_seconds,0)/60, ' phút')
          ELSE CONCAT(
                 COALESCE(ls.total_seconds,0)/3600, ' Giờ ',
                 (COALESCE(ls.total_seconds,0)%3600)/60, ' phút'
               )
        END                             AS total_duration
      FROM enrollments     e
      JOIN courses         c  ON c.course_id = e.course_id
      LEFT JOIN lesson_stats  ls ON ls.course_id = c.course_id
      LEFT JOIN completed_cnt cc ON cc.course_id = c.course_id
      WHERE e.user_uid = $1`,
      [uid]
    );

    const inProgress = [];
    const completed = [];

    result.rows.forEach((row) => {
      if (Number(row.progress_percent) === 100 && Number(row.total_lessons) > 0) {
        completed.push(row);
      } else {
        inProgress.push(row);
      }
    });

    return res.status(200).json({
      message: "Khoá học đã đăng ký kèm tiến độ",
      data: {
        in_progress: inProgress,
        completed: completed,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: "Lỗi truy vấn: " + err.message });
  }
};

module.exports = getCoursesByUser;
