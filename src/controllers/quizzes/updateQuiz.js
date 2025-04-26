const { sql, poolPromise } = require("../../config/db.config");

const updateQuiz = async (req, res) => {
  const { quiz_id } = req.params;
  const { uid, title, type, time_limit, attempt_limit } = req.body;

  if (!uid) {
    return res.status(400).json({ error: "Thiếu UID người dùng" });
  }

  try {
    const pool = await poolPromise;

    // 1. Lấy vai trò người dùng
    const roleRequest = new sql.Request(pool);
    roleRequest.input("uid", sql.NVarChar, uid);
    const roleResult = await roleRequest.query(`
      SELECT role FROM users WHERE uid = @uid
    `);
    const role = roleResult.recordset[0]?.role;

    // 2. Lấy thông tin quiz hiện tại
    const quizRequest = new sql.Request(pool);
    quizRequest.input("quiz_id", sql.Int, quiz_id);
    const quizResult = await quizRequest.query(`
      SELECT * FROM quizzes WHERE quiz_id = @quiz_id
    `);

    if (quizResult.recordset.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy bài kiểm tra" });
    }

    const current = quizResult.recordset[0];
    const creator_uid = current.creator_uid?.trim();

    // 3. Kiểm tra quyền
    if (role !== "admin" && creator_uid !== uid) {
      return res.status(403).json({
        error: "Bạn không có quyền sửa bài kiểm tra này",
      });
    }

    // 4. Merge dữ liệu cập nhật
    const updatedTitle = title ?? current.title;
    const updatedType = type ?? current.type;
    const updatedTimeLimit = time_limit ?? current.time_limit;
    const updatedAttemptLimit = attempt_limit ?? current.attempt_limit;

    // 5. Cập nhật dữ liệu
    const updateRequest = new sql.Request(pool);
    updateRequest.input("quiz_id", sql.Int, quiz_id);
    updateRequest.input("title", sql.NVarChar, updatedTitle);
    updateRequest.input("type", sql.NVarChar, updatedType);
    updateRequest.input("time_limit", sql.Int, updatedTimeLimit);
    updateRequest.input("attempt_limit", sql.Int, updatedAttemptLimit);

    await updateRequest.query(`
      UPDATE quizzes SET
        title = @title,
        type = @type,
        time_limit = @time_limit,
        attempt_limit = @attempt_limit,
        updated_at = GETDATE()
      WHERE quiz_id = @quiz_id
    `);

    // 6. Trả về quiz đã cập nhật
    const finalResult = await updateRequest.query(`
      SELECT * FROM quizzes WHERE quiz_id = @quiz_id
    `);

    const updated = finalResult.recordset[0];
    if (updated?.creator_uid) {
      updated.creator_uid = updated.creator_uid.trim();
    }

    res.status(200).json({
      message: "Cập nhật bài kiểm tra thành công",
      data: updated,
    });
  } catch (err) {
    res.status(500).json({
      error: "Lỗi cập nhật bài kiểm tra: " + err.message,
    });
  }
};

module.exports = updateQuiz;
