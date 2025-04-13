const { sql, poolConnect } = require("../../config/db.config");

const deleteQuestion = async (req, res) => {
  const { question_id } = req.params; // question_id từ URL

  try {
    const pool = await poolConnect; // Đảm bảo kết nối đã được thiết lập
    const request = new sql.Request(pool);
    request.input("question_id", sql.Int, question_id);

    const result = await request.query(
      "DELETE FROM quiz_questions WHERE question_id = @question_id"
    );

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: "Câu hỏi không tồn tại" });
    }

    res.status(200).json({ message: "Xóa câu hỏi thành công" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi khi xóa câu hỏi: " + err.message });
  }
};
module.exports = deleteQuestion;
