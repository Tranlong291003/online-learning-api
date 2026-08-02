const { pool } = require("../../config/db.config");

const deleteQuestion = async (req, res) => {
  const { question_id } = req.params;
  const { uid } = req.body;

  if (!uid) {
    return res.status(400).json({ error: "UID không hợp lệ" });
  }

  try {
    // Kiểm tra quyền
    const roleResult = await pool.query("SELECT role FROM users WHERE uid = $1", [uid]);
    const userRole = roleResult.rows[0]?.role;

    if (userRole !== "admin" && userRole !== "mentor") {
      return res.status(403).json({ error: "Bạn không có quyền xóa câu hỏi" });
    }

    // Xóa
    const result = await pool.query(
      "DELETE FROM quiz_questions WHERE question_id = $1 RETURNING question_id",
      [question_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Câu hỏi không tồn tại" });
    }

    res.status(200).json({ message: "Xóa câu hỏi thành công" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi khi xóa câu hỏi: " + err.message });
  }
};

module.exports = deleteQuestion;
