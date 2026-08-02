const { pool } = require("../config/db.config");

// API thống kê động theo role
exports.getStats = async (req, res) => {
  try {
    const uid = req.body.uid || req.query.uid;
    if (!uid) {
      return res.status(400).json({ error: "Thiếu uid" });
    }

    // Kiểm tra role từ DB
    const resultRole = await pool.query("SELECT role FROM users WHERE uid = $1", [uid]);
    if (resultRole.rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy user" });
    }
    const role = resultRole.rows[0].role;

    if (role === "admin") {
      const result = await pool.query(`
        SELECT
          (SELECT COUNT(*) FROM courses) AS total_courses,
          (SELECT COUNT(*) FROM users) AS total_users,
          (SELECT COUNT(*) FROM quizzes) AS total_quizzes,
          (SELECT COUNT(*) FROM course_reviews) AS total_reviews
      `);
      return res.json({ role: "admin", ...result.rows[0] });
    } else if (role === "mentor") {
      const result = await pool.query(
        `SELECT
          (SELECT COUNT(*) FROM courses WHERE instructor_uid = $1) AS total_courses,
          (SELECT COALESCE(SUM(enroll_count),0) FROM (
            SELECT COUNT(*) AS enroll_count FROM enrollments e
            JOIN courses c ON c.course_id = e.course_id
            WHERE c.instructor_uid = $1
            GROUP BY e.course_id
          ) t) AS total_students,
          (SELECT COUNT(*) FROM lessons l JOIN courses c ON l.course_id = c.course_id WHERE c.instructor_uid = $1) AS total_lessons,
          (SELECT ROUND(AVG(rating)::NUMERIC, 1) FROM (
            SELECT AVG(r.rating::FLOAT) AS rating
            FROM course_reviews r
            JOIN courses c ON r.course_id = c.course_id
            WHERE c.instructor_uid = $1
            GROUP BY r.course_id
          ) t) AS avg_rating`,
        [uid]
      );
      return res.json({ role: "mentor", ...result.rows[0] });
    } else {
      return res.status(403).json({ error: "Bạn không có quyền xem thống kê này" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
