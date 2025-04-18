const { sql, poolPromise } = require("../../config/db.config");

const deleteQuiz = async (req, res) => {
  const { quiz_id } = req.params;
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

    // Kiểm tra quyền xóa bài kiểm tra (Admin hoặc Giảng viên)
    if (userRole !== "admin" && userRole !== "giang_vien") {
      return res.status(403).json({
        error: "Bạn không có quyền xóa bài kiểm tra",
      });
    }

    // Xóa bài kiểm tra
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
