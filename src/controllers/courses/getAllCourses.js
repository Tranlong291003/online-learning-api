// controllers/courseCategories/getAllCourses.js
const { sql, poolPromise } = require("../../config/db.config");

const getAllCourses = async (req, res) => {
  try {
    let { status, category, search } = req.query;

    const pool = await poolPromise;
    const request = pool.request();
    const conditions = [];

    if (status && status.trim() !== "" && status !== "all") {
      request.input("status", sql.NVarChar, status.trim());
      conditions.push("c.status = @status");
    }

    if (category && category.trim() !== "") {
      const catId = parseInt(category, 10);
      if (!isNaN(catId) && catId !== 0) {
        request.input("categoryId", sql.Int, catId);
        conditions.push("c.category_id = @categoryId");
      }
    }

    if (search && search.trim() !== "") {
      const kw = `%${search.trim()}%`;
      request.input("search", sql.NVarChar, kw);
      conditions.push(
        "(c.title LIKE @search OR u.name LIKE @search OR cat.name LIKE @search)"
      );
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const sqlQuery = `
      SELECT
        c.course_id,
        c.title,
        c.instructor_uid,
        c.category_id,
        c.price,
        c.level,
        c.discount_price,
        c.thumbnail_url,
        c.status,
        c.rejection_reason,
        c.updated_at,
        u.name           AS instructor_name,
        u.avatar_url     AS instructor_avatar,
        cat.name         AS category_name,
        COALESCE(r.avg_rating, 0)    AS rating,
        COALESCE(e.enroll_count, 0)  AS enroll_count,
        l.lesson_count,
        l.total_seconds
      FROM courses c
      LEFT JOIN users u
        ON c.instructor_uid = u.uid
      LEFT JOIN course_categories cat
        ON c.category_id = cat.category_id

      /* tính điểm trung bình từ bảng course_reviews */
      LEFT JOIN (
        SELECT
          course_id,
          AVG(CAST(rating AS FLOAT)) AS avg_rating
        FROM course_reviews
        GROUP BY course_id
      ) r ON r.course_id = c.course_id

      /* đếm số người đăng ký từ bảng enrollments */
      LEFT JOIN (
        SELECT
          course_id,
          COUNT(*) AS enroll_count
        FROM enrollments
        GROUP BY course_id
      ) e ON e.course_id = c.course_id

      /* tính tổng thời gian video và số lượng bài học */
      LEFT JOIN (
        SELECT
          course_id,
          COUNT(*) as lesson_count,
          SUM(
            CAST(SUBSTRING(video_duration, 1, 2) AS INT) * 3600 +
            CAST(SUBSTRING(video_duration, 4, 2) AS INT) * 60 +
            CAST(SUBSTRING(video_duration, 7, 2) AS INT)
          ) as total_seconds
        FROM lessons
        WHERE video_duration IS NOT NULL
        GROUP BY course_id
      ) l ON l.course_id = c.course_id

      ${whereClause}
      ORDER BY c.updated_at DESC
    `;

    const result = await request.query(sqlQuery);
    const courses = result.recordset.map((course) => {
      const { total_seconds, ...rest } = course;
      return {
        ...rest,
        total_duration: total_seconds
          ? `${String(Math.floor(total_seconds / 3600)).padStart(
              2,
              "0"
            )}:${String(Math.floor((total_seconds % 3600) / 60)).padStart(
              2,
              "0"
            )}:${String(total_seconds % 60).padStart(2, "0")}`
          : "00:00:00",
        lesson_count: course.lesson_count || 0,
      };
    });

    if (courses.length === 0) {
      return res.status(200).json({ message: "Không có khóa học" });
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
    return res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

module.exports = getAllCourses;
