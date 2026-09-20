const { pool } = require("../../config/db.config");
const { sendServerError } = require("../../utils/errorResponse");
const { resolveActorUid } = require("../../middleware/actor");

const updateQuiz = async (req, res) => {
  const { quiz_id } = req.params;
  const { title, type, time_limit, attempt_limit } = req.body;

  // Lấy uid từ token; chỉ admin mới được thao tác thay người khác
  const uid = resolveActorUid(req, res, req.body.uid);
  if (!uid) return;

  try {
    // Lấy vai trò
    const roleResult = await pool.query("SELECT role FROM users WHERE uid = $1", [uid]);
    const role = roleResult.rows[0]?.role;

    // Lấy thông tin quiz
    const quizResult = await pool.query("SELECT * FROM quizzes WHERE quiz_id = $1", [quiz_id]);

    if (quizResult.rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy bài kiểm tra" });
    }

    const current = quizResult.rows[0];
    const creator_uid = current.creator_uid?.trim();

    // Kiểm tra quyền
    if (role !== "admin" && creator_uid !== uid) {
      return res.status(403).json({
        error: "Bạn không có quyền sửa bài kiểm tra này",
      });
    }

    // Merge dữ liệu
    const updatedTitle = title ?? current.title;
    const updatedType = type ?? current.type;
    const updatedTimeLimit = time_limit ?? current.time_limit;
    const updatedAttemptLimit = attempt_limit ?? current.attempt_limit;

    // Update
    const updateResult = await pool.query(
      `UPDATE quizzes SET
        title = $1,
        type = $2,
        time_limit = $3,
        attempt_limit = $4,
        updated_at = NOW()
      WHERE quiz_id = $5
      RETURNING *`,
      [updatedTitle, updatedType, updatedTimeLimit, updatedAttemptLimit, quiz_id]
    );

    const updated = updateResult.rows[0];
    if (updated?.creator_uid) {
      updated.creator_uid = updated.creator_uid.trim();
    }

    res.status(200).json({
      message: "Cập nhật bài kiểm tra thành công",
      data: updated,
    });
  } catch (err) {
    sendServerError(res, "Lỗi cập nhật bài kiểm tra", err);
  }
};

module.exports = updateQuiz;
