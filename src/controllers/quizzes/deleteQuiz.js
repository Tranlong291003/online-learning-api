const { sql, poolPromise } = require("../../config/db.config");

const deleteQuiz = async (req, res) => {
  const { quiz_id } = req.params;
  const { uid } = req.body;

  if (!uid) {
    return res.status(400).json({ error: "Thiếu UID người dùng" });
  }

  try {
    const pool = await poolPromise;

    // 1. Lấy role người dùng
    const roleReq = new sql.Request(pool);
    roleReq.input("uid", sql.NVarChar, uid);
    const roleResult = await roleReq.query(`
      SELECT role FROM users WHERE uid = @uid
    `);
    const role = roleResult.recordset[0]?.role;

    // 2. Lấy thông tin quiz
    const quizReq = new sql.Request(pool);
    quizReq.input("quiz_id", sql.Int, quiz_id);
    const quizResult = await quizReq.query(`
      SELECT creator_uid FROM quizzes WHERE quiz_id = @quiz_id
    `);

    if (quizResult.recordset.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy bài kiểm tra" });
    }

    const creatorUid = quizResult.recordset[0].creator_uid?.trim();

    // 3. Kiểm tra quyền xoá
    if (role !== "admin" && creatorUid !== uid.trim()) {
      return res.status(403).json({
        error: "Bạn không có quyền xoá bài kiểm tra này",
      });
    }

    // 4. Xoá quiz
    const deleteReq = new sql.Request(pool);
    deleteReq.input("quiz_id", sql.Int, quiz_id);
    await deleteReq.query(`DELETE FROM quizzes WHERE quiz_id = @quiz_id`);

    res.status(200).json({ message: "Xoá bài kiểm tra thành công" });
  } catch (err) {
    res.status(500).json({
      error: "Lỗi xoá bài kiểm tra: " + err.message,
    });
  }
};

module.exports = deleteQuiz;
