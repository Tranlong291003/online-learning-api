const { pool } = require("../../config/db.config");

const getMentorCourses = async (req, res) => {
  try {
    const { instructor_uid } = req.params;

    if (!instructor_uid) {
      return res.status(400).json({ error: "Thiếu instructor_uid" });
    }

    const sqlQuery = `
      SELECT
        c.course_id,
        c.title,
        c.description,
        c.instructor_uid,
        c.category_id,
        c.price,
        c.level,
        c.discount_price,
        c.thumbnail_url,
        c.status,
        c.rejection_reason,
        c.language,
        c.tags,
        c.created_at,
        c.updated_at,
        c.approved_at,
        u.name           AS instructor_name,
        u.avatar_url     AS instructor_avatar,
        u.bio           AS instructor_bio,
        cat.name         AS category_name,
        COALESCE(r.avg_rating, 0)    AS rating,
        COALESCE(r.review_count, 0)  AS review_count,
        COALESCE(e.enroll_count, 0)  AS enroll_count,
        l.lesson_count,
        l.total_seconds
      FROM courses c
      LEFT JOIN users u ON c.instructor_uid = u.uid
      LEFT JOIN course_categories cat ON c.category_id = cat.category_id

      LEFT JOIN (
        SELECT
          course_id,
          AVG(rating::FLOAT) AS avg_rating,
          COUNT(*) AS review_count
        FROM course_reviews
        GROUP BY course_id
      ) r ON r.course_id = c.course_id

      LEFT JOIN (
        SELECT
          course_id,
          COUNT(*) AS enroll_count
        FROM enrollments
        GROUP BY course_id
      ) e ON e.course_id = c.course_id

      LEFT JOIN (
        SELECT
          course_id,
          COUNT(*) as lesson_count,
          SUM(
            CASE
              WHEN video_duration ~ '^[0-9]{2}:[0-9]{2}:[0-9]{2}$' THEN
                CAST(SUBSTRING(video_duration, 1, 2) AS INT) * 3600 +
                CAST(SUBSTRING(video_duration, 4, 2) AS INT) * 60 +
                CAST(SUBSTRING(video_duration, 7, 2) AS INT)
              WHEN video_duration ~ '^[0-9]{2}:[0-9]{2}$' THEN
                CAST(SUBSTRING(video_duration, 1, 2) AS INT) * 60 +
                CAST(SUBSTRING(video_duration, 4, 2) AS INT)
              ELSE 0
            END
          ) as total_seconds
        FROM lessons
        GROUP BY course_id
      ) l ON l.course_id = c.course_id

      WHERE c.instructor_uid = $1
      ORDER BY c.updated_at DESC NULLS LAST, c.created_at DESC
    `;

    const result = await pool.query(sqlQuery, [instructor_uid]);
    const courses = result.rows.map((course) => {
      const { total_seconds, ...rest } = course;
      return {
        ...rest,
        total_duration: total_seconds
          ? `${String(Math.floor(total_seconds / 3600)).padStart(2, "0")}:${String(Math.floor((total_seconds % 3600) / 60)).padStart(2, "0")}:${String(total_seconds % 60).padStart(2, "0")}`
          : "00:00:00",
        lesson_count: course.lesson_count || 0,
        discount_percent:
          course.discount_price && course.price
            ? Math.round(
                ((course.price - course.discount_price) / course.price) * 100
              )
            : 0,
      };
    });

    if (courses.length === 0) {
      return res
        .status(200)
        .json({ message: "Không có khóa học nào của mentor này" });
    }

    // Phân loại khóa học theo 3 trạng thái
    const groupedCourses = courses.reduce(
      (acc, course) => {
        const status = course.status || "pending";
        if (!acc[status]) {
          acc[status] = [];
        }
        acc[status].push(course);
        return acc;
      },
      {
        pending: [],
        approved: [],
        rejected: [],
      }
    );

    return res.status(200).json({
      data: groupedCourses,
      total: courses.length,
    });
  } catch (err) {
    console.error("Lỗi lấy danh sách khóa học của mentor:", err);
    return res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

module.exports = getMentorCourses;
