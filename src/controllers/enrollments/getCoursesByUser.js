// src/controllers/courses/getCoursesByUser.js
const { sql, poolPromise } = require("../../config/db.config");

const getCoursesByUser = async (req, res) => {
  const { uid } = req.params;
  if (!uid) {
    return res.status(400).json({ error: "Thiếu uid người dùng" });
  }

  try {
    const pool = await poolPromise;
    const rq = new sql.Request(pool);
    rq.input("uid", sql.NVarChar, uid);

    /* ══════════ QUERY ══════════ */
    const rs = await rq.query(`
      WITH lesson_stats AS (
        SELECT course_id,
               COUNT(*) AS total_lessons,
               SUM(
                 CASE
                   WHEN video_duration LIKE '%:%:%'
                     THEN DATEDIFF(SECOND, 0, TRY_CONVERT(time, video_duration))
                   WHEN video_duration LIKE '%:%'
                     THEN DATEDIFF(SECOND, 0, TRY_CONVERT(time, '00:' + video_duration))
                   WHEN video_duration NOT LIKE '%:%'
                     THEN TRY_CAST(video_duration AS INT)
                   ELSE 0
                 END
               ) AS total_seconds
        FROM lessons
        GROUP BY course_id
      ),
      completed_cnt AS (
        SELECT course_id, COUNT(*) AS completed_lessons
        FROM lesson_progress
        WHERE user_uid = @uid AND is_completed = 1
        GROUP BY course_id
      )
      SELECT
        c.course_id,
        c.title,
        c.thumbnail_url,
        ISNULL(ls.total_lessons, 0)     AS total_lessons,
        ISNULL(cc.completed_lessons, 0) AS completed_lessons,
        CASE
          WHEN ISNULL(ls.total_lessons,0)=0
            THEN 0
          ELSE FLOOR(ISNULL(cc.completed_lessons,0)*100.0/ls.total_lessons)
        END                             AS progress_percent,
        CASE
          WHEN ISNULL(ls.total_seconds,0) < 3600
            THEN CONCAT(ISNULL(ls.total_seconds,0)/60, N' phút')
          ELSE CONCAT(
                 ISNULL(ls.total_seconds,0)/3600, N' Giờ ',
                 (ISNULL(ls.total_seconds,0)%3600)/60, N' phút'
               )
        END                             AS total_duration
      FROM enrollments     e
      JOIN courses         c  ON c.course_id = e.course_id
      LEFT JOIN lesson_stats  ls ON ls.course_id = c.course_id
      LEFT JOIN completed_cnt cc ON cc.course_id = c.course_id
      WHERE e.user_uid = @uid;
    `);

    /* ══════════ PHÂN LOẠI ══════════ */
    const inProgress = [];
    const completed = [];

    rs.recordset.forEach((row) => {
      if (row.progress_percent === 100 && row.total_lessons > 0) {
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
