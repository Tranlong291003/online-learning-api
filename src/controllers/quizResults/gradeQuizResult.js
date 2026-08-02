const { pool } = require("../../config/db.config");

const gradeQuizResult = async (req, res) => {
  const { result_id } = req.params;
  const { explanation, score, uid } = req.body;

  if (!explanation || score === undefined || !uid) {
    return res.status(400).json({ error: "Thiếu thông tin chấm điểm hoặc giải thích" });
  }

  try {
    // Lấy thông tin người chấm
    const userResult = await pool.query("SELECT uid, role FROM users WHERE uid = $1", [uid]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy người chấm điểm" });
    }

    const graded_by = uid;
    const userRole = userResult.rows[0].role;

    if (userRole !== "admin" && userRole !== "mentor") {
      return res.status(403).json({ error: "Bạn không có quyền chấm điểm bài kiểm tra" });
    }

    // Update
    const result = await pool.query(
      `UPDATE quiz_results
       SET explanation = $1, score = $2, status = 'da_cham', graded_by_uid = $3, graded_at = NOW()
       WHERE result_id = $4
       RETURNING result_id`,
      [explanation, score, graded_by, result_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Kết quả không tồn tại" });
    }

    res.status(200).json({ message: "Chấm điểm bài kiểm tra thành công" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi khi chấm điểm bài kiểm tra: " + err.message });
  }
};

module.exports = gradeQuizResult;
