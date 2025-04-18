const { sql, poolPromise } = require("../../config/db.config");

const deleteQuestion = async (req, res) => {
  const { question_id } = req.params; // question_id từ URL
  const { uid } = req.body; // UID để kiểm tra quyền người dùng

  if (!uid) {
    return res.status(400).json({ error: "UID không hợp lệ" });
  }

  try {
    const pool = await poolPromise; // Sử dụng poolPromise để kết nối
    const request = new sql.Request(pool);

    // Kiểm tra quyền của người dùng
    request.input("uid", sql.NVarChar, uid);
    const roleQuery = await request.query(
      `SELECT role FROM users WHERE uid = @uid`
    );

    const userRole = roleQuery.recordset[0]?.role;

    // Kiểm tra quyền xóa câu hỏi (Admin hoặc Giảng viên)
    if (userRole !== "admin" && userRole !== "giang_vien") {
      return res.status(403).json({
        error: "Bạn không có quyền xóa câu hỏi",
      });
    }

    // Xóa câu hỏi
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
