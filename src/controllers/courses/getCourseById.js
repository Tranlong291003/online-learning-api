// controllers/courseCategories/getCourseById.js
const { sql, poolPromise } = require("../../config/db.config");

const getCourseById = async (req, res) => {
  const { course_id } = req.params;

  try {
    const pool = await poolPromise;
    const request = pool.request().input("course_id", sql.Int, course_id);

    const query = `
SELECT
  -- Course info
  c.course_id,
  c.title,
  c.description,
  c.level,
  c.language,
  c.tags,
  c.price,
  c.discount_price,
  c.status,
  c.approved_at,
  c.thumbnail_url,
  c.created_at,
  c.updated_at,
  c.rejection_reason,

  -- Category
  c.category_id,
  cat.name            AS category_name,

  -- Instructor
  c.instructor_uid,
  u.name              AS instructor_name,
  u.avatar_url        AS instructor_avatar_url,
  u.bio               AS instructor_bio,

  -- Ratings
  ROUND(
    (
      SELECT AVG(CAST(r.rating AS FLOAT))
      FROM course_reviews r
      WHERE r.course_id = c.course_id
    ), 1
  )                    AS avg_rating,
  (
    SELECT COUNT(DISTINCT r.user_uid)
    FROM course_reviews r
    WHERE r.course_id = c.course_id
  )                    AS review_count,

  -- Enrollments
  (
    SELECT COUNT(*)
    FROM enrollments e
    WHERE e.course_id = c.course_id
  )                    AS enrollment_count,

  -- Total video duration (HH:MM:SS)
  CONVERT(VARCHAR(8),
    DATEADD(second,
      ISNULL(SUM(DATEDIFF(second, 0, TRY_CAST(l.video_duration AS TIME))), 0),
      0
    ), 108
  )                    AS total_video_duration,

  -- Last update info
  (
    SELECT TOP 1 updated_at
    FROM lessons
    WHERE course_id = c.course_id
    ORDER BY updated_at DESC
  )                    AS last_lesson_update,
  (
    SELECT COUNT(*)
    FROM lessons
    WHERE course_id = c.course_id
  )                    AS lesson_count

FROM courses c
LEFT JOIN course_categories cat ON c.category_id   = cat.category_id
LEFT JOIN users            u   ON c.instructor_uid = u.uid
LEFT JOIN lessons          l   ON l.course_id      = c.course_id
WHERE c.course_id = @course_id
GROUP BY
  c.course_id,
  c.title,
  c.description,
  c.level,
  c.language,
  c.tags,
  c.price,
  c.discount_price,
  c.status,
  c.approved_at,
  c.thumbnail_url,
  c.created_at,
  c.updated_at,
  c.rejection_reason,
  c.category_id,
  cat.name,
  c.instructor_uid,
  u.name,
  u.avatar_url,
  u.bio;
    `;

    const result = await request.query(query);
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy khóa học" });
    }

    // Tính toán thêm một số thông tin
    const course = result.recordset[0];
    const response = {
      ...course,
      // Tính phần trăm giảm giá nếu có
      discount_percent:
        course.discount_price && course.price
          ? Math.round(
              ((course.price - course.discount_price) / course.price) * 100
            )
          : 0,
      // Xác định thời gian cập nhật gần nhất
      last_update:
        course.last_lesson_update > course.updated_at
          ? course.last_lesson_update
          : course.updated_at,
    };

    return res.status(200).json({
      message: "Lấy chi tiết khóa học thành công",
      data: response,
    });
  } catch (err) {
    return res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

module.exports = getCourseById;
