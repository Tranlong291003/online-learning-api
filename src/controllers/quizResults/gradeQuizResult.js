const { sql, poolConnect, pool } = require("../../config/db.config");

const gradeQuizResult = async (req, res) => {
  const { id } = req.params; // result_id từ URL
  const { explanation, score, graded_by } = req.body;

  if (!explanation || score === undefined || !graded_by) {
    return res
      .status(400)
      .json({ error: "Thiếu thông tin chấm điểm hoặc giải thích" });
  }

  try {
    const pool = await poolConnect; // Đảm bảo kết nối đã được thiết lập
    const request = new sql.Request(pool);
    request.input("result_id", sql.Int, id);
    request.input("explanation", sql.NVarChar, explanation);
    request.input("score", sql.Float, score);
    request.input("graded_by", sql.Int, graded_by);

    const result = await request.query(
      "UPDATE quiz_results SET explanation = @explanation, score = @score, status = 'da_cham', graded_by = @graded_by, graded_at = GETDATE() WHERE result_id = @result_id"
    );

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: "Kết quả không tồn tại" });
    }

    res.status(200).json({ message: "Chấm điểm bài kiểm tra thành công" });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: "Lỗi khi chấm điểm bài kiểm tra: " + err.message });
  }
};
module.exports = gradeQuizResult;
