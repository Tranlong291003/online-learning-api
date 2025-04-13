const { sql, poolConnect, pool } = require("../../config/db.config");

const deleteQuiz = async (req, res) => {
  const { quiz_id } = req.params;

  try {
    const pool = await poolConnect; // Đảm bảo kết nối đã được thiết lập
    const request = new sql.Request(pool);
    request.input("quiz_id", sql.Int, quiz_id);

    const result = await request.query(
      "DELETE FROM quizzes WHERE quiz_id = @quiz_id"
    );

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: "Bài kiểm tra không tồn tại" });
    }

    res.status(200).json({ message: "Xóa bài kiểm tra thành công" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi khi xóa bài kiểm tra: " + err.message });
  }
};

module.exports = deleteQuiz;
