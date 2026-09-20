const { pool } = require("../../config/db.config");
const { resolveActorUid } = require("../../middleware/actor");

const getQuizResultsByUser = async (req, res) => {
  // Chỉ được xem kết quả của chính mình (admin xem được của người khác)
  const user_uid = resolveActorUid(req, res, req.params.user_uid);
  if (!user_uid) return;

  try {
    const listRes = await pool.query(
      `SELECT
        qr.result_id,
        q.title,
        qr.score,
        CASE WHEN qr.score >= 5.0 THEN 1 ELSE 0 END AS passed,
        qr.submitted_at
      FROM quiz_results qr
      JOIN quizzes q ON q.quiz_id = qr.quiz_id
      WHERE qr.user_uid = $1
      ORDER BY qr.submitted_at DESC`,
      [user_uid]
    );

    return res.json({
      user_uid,
      total: listRes.rows.length,
      results: listRes.rows.map((r) => ({
        ...r,
        passed: !!parseInt(r.passed),
        // submitted_at có thể NULL ở dữ liệu cũ, không được gọi toISOString trực tiếp
        submitted_at: r.submitted_at ? new Date(r.submitted_at).toISOString() : null,
      })),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Lỗi khi lấy danh sách kết quả: " + err.message });
  }
};

module.exports = getQuizResultsByUser;
