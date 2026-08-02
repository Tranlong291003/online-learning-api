const { pool } = require("../../config/db.config");

const getQuizzesByCourse = async (req, res) => {
  const { course_id } = req.params;

  if (!course_id) {
    return res.status(400).json({ error: "Thiếu course_id" });
  }

  try {
    const result = await pool.query(
      `SELECT
        q.quiz_id,
        q.title,
        q.description,
        q.type,
        q.time_limit,
        q.attempt_limit,
        q.creator_uid,
        q.created_at,
        q.updated_at,
        COUNT(DISTINCT qq.question_id) as total_questions,
        ROUND(AVG(qr.score::FLOAT)::NUMERIC, 2) as average_score,
        ROUND(
          CASE
            WHEN COUNT(qr.result_id) > 0
            THEN (COUNT(CASE WHEN qr.score >= 5 THEN 1 END) * 100.0 / COUNT(qr.result_id))
            ELSE 0
          END::NUMERIC, 2
        ) as passing_rate
      FROM quizzes q
      LEFT JOIN quiz_questions qq ON q.quiz_id = qq.quiz_id
      LEFT JOIN quiz_results qr ON q.quiz_id = qr.quiz_id
      WHERE q.course_id = $1
      GROUP BY
        q.quiz_id,
        q.title,
        q.description,
        q.type,
        q.time_limit,
        q.attempt_limit,
        q.creator_uid,
        q.created_at,
        q.updated_at`,
      [course_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Không tìm thấy bài kiểm tra cho khóa học này",
      });
    }

    res.status(200).json({
      message: "📋 Danh sách bài kiểm tra của khóa học",
      data: result.rows,
    });
  } catch (err) {
    res.status(500).json({
      error: "Lỗi khi lấy danh sách bài kiểm tra: " + err.message,
    });
  }
};

module.exports = getQuizzesByCourse;
