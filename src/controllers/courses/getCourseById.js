const { pool } = require("../../config/db.config");
const { sendServerError } = require("../../utils/errorResponse");
const { parsePositiveInt } = require("../../utils/parseId");
const { computeDiscountPercent } = require("../../utils/coursePricing");

const getCourseById = async (req, res) => {
  const course_id = parsePositiveInt(req.params.course_id);

  if (!course_id) {
    return res.status(400).json({ error: "course_id không hợp lệ" });
  }

  try {
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
        cat.name AS category_name,

        -- Instructor
        c.instructor_uid,
        u.name AS instructor_name,
        u.avatar_url AS instructor_avatar_url,
        u.bio AS instructor_bio,

        -- Ratings
        ROUND(
          (SELECT AVG(r.rating::FLOAT) FROM course_reviews r WHERE r.course_id = c.course_id)::NUMERIC,
          1
        ) AS avg_rating,
        (SELECT COUNT(DISTINCT r.user_uid) FROM course_reviews r WHERE r.course_id = c.course_id) AS review_count,

        -- Enrollments
        (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.course_id) AS enrollment_count,

        -- Total video duration
        SUM(
          CASE
            WHEN l.video_duration ~ '^[0-9]{2}:[0-9]{2}:[0-9]{2}$' THEN
              CAST(SUBSTRING(l.video_duration, 1, 2) AS INT) * 3600 +
              CAST(SUBSTRING(l.video_duration, 4, 2) AS INT) * 60 +
              CAST(SUBSTRING(l.video_duration, 7, 2) AS INT)
            ELSE 0
          END
        ) AS total_video_seconds,

        -- Lesson info
        (SELECT updated_at FROM lessons WHERE course_id = c.course_id ORDER BY updated_at DESC LIMIT 1) AS last_lesson_update,
        (SELECT COUNT(*) FROM lessons WHERE course_id = c.course_id) AS lesson_count

      FROM courses c
      LEFT JOIN course_categories cat ON c.category_id = cat.category_id
      LEFT JOIN users u ON c.instructor_uid = u.uid
      LEFT JOIN lessons l ON l.course_id = c.course_id
      WHERE c.course_id = $1
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
        u.bio
    `;

    const result = await pool.query(query, [course_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy khóa học" });
    }

    const course = result.rows[0];
    const { total_video_seconds, ...courseData } = course;
    const seconds = Number(total_video_seconds || 0);
    const response = {
      ...courseData,
      total_video_duration: `${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`,
      // Kẹp trong 0–100: dữ liệu cũ có thể có discount_price > price (trước khi
      // thêm validate), khi đó công thức cho ra số âm và hiển thị trên app vô nghĩa.
      discount_percent: computeDiscountPercent(course.price, course.discount_price),
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
    return sendServerError(res, "Lỗi server", err);
  }
};

module.exports = getCourseById;
