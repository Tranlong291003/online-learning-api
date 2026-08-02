const { pool } = require("../../config/db.config");

const createQuiz = async (req, res) => {
  const { course_id, title, type, time_limit, attempt_limit, uid } = req.body;

  if (!course_id || !title) {
    return res.status(400).json({ error: "Thiếu thông tin khóa học hoặc tiêu đề" });
  }

  if (!uid) {
    return res.status(400).json({ error: "UID không hợp lệ" });
  }

  try {
    // Kiểm tra vai trò
    const roleResult = await pool.query("SELECT role FROM users WHERE uid = $1", [uid]);
    const role = roleResult.rows[0]?.role;

    if (role !== "admin" && role !== "mentor") {
      return res.status(403).json({ error: "Bạn không có quyền tạo bài kiểm tra" });
    }

    // Tạo quiz
    const result = await pool.query(
      `INSERT INTO quizzes (course_id, title, type, time_limit, attempt_limit, creator_uid, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING *`,
      [course_id, title, type || "trac_nghiem", time_limit || null, attempt_limit || null, uid]
    );

    const quiz = result.rows[0];
    if (quiz?.creator_uid) {
      quiz.creator_uid = quiz.creator_uid.trim();
    }

    res.status(201).json({
      message: "Tạo bài kiểm tra thành công",
      data: quiz,
    });
  } catch (err) {
    res.status(500).json({ error: "Lỗi khi tạo bài kiểm tra: " + err.message });
  }
};

module.exports = createQuiz;
