// /controllers/quiz/getQuizResultsByUser.js
const { sql, poolPromise } = require("../../config/db.config");

const getQuizResultsByUser = async (req, res) => {
  const { user_uid } = req.params;
  if (!user_uid) return res.status(400).json({ error: "Thiếu user_uid" });

  try {
    const pool = await poolPromise;
    const request = new sql.Request(pool);
    request.input("user_uid", sql.NVarChar, user_uid);

    /* Trả về thông tin tối cần thiết */
    const listRes = await request.query(`
      SELECT
        qr.result_id,
        q.title,
        qr.score,
        CASE WHEN qr.score >= 5.0 THEN 1 ELSE 0 END AS passed,
        qr.submitted_at
      FROM quiz_results qr
      JOIN quizzes q ON q.quiz_id = qr.quiz_id
      WHERE qr.user_uid = @user_uid
      ORDER BY qr.submitted_at DESC
    `);

    return res.json({
      user_uid,
      total: listRes.recordset.length,
      results: listRes.recordset.map((r) => ({
        ...r,
        passed: !!r.passed, // ép về boolean cho frontend
        submitted_at: r.submitted_at.toISOString(),
      })),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "Lỗi khi lấy danh sách kết quả: " + err.message,
    });
  }
};

module.exports = getQuizResultsByUser;
