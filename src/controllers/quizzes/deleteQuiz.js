const { pool } = require("../../config/db.config");
const { parsePositiveInt } = require("../../utils/parseId");
const { sendServerError } = require("../../utils/errorResponse");
const { resolveActorUid } = require("../../middleware/actor");

const deleteQuiz = async (req, res) => {
  const quiz_id = parsePositiveInt(req.params.quiz_id);

  if (!quiz_id) {
    return res.status(400).json({ error: "quiz_id không hợp lệ" });
  }

  // Lấy uid từ token; chỉ admin mới được thao tác thay người khác
  const uid = resolveActorUid(req, res, req.body.uid);
  if (!uid) return;

  try {
    // Lấy role
    const roleResult = await pool.query("SELECT role FROM users WHERE uid = $1", [uid]);
    const role = roleResult.rows[0]?.role;

    // Lấy thông tin quiz
    const quizResult = await pool.query(
      "SELECT creator_uid FROM quizzes WHERE quiz_id = $1",
      [quiz_id]
    );

    if (quizResult.rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy bài kiểm tra" });
    }

    const creatorUid = quizResult.rows[0].creator_uid?.trim();

    // Kiểm tra quyền
    if (role !== "admin" && creatorUid !== uid.trim()) {
      return res.status(403).json({
        error: "Bạn không có quyền xoá bài kiểm tra này",
      });
    }

    // Xoá quiz
    await pool.query("DELETE FROM quiz_results WHERE quiz_id = $1", [quiz_id]);
    await pool.query("DELETE FROM quizzes WHERE quiz_id = $1", [quiz_id]);

    res.status(200).json({ message: "Xoá bài kiểm tra thành công" });
  } catch (err) {
    sendServerError(res, "Lỗi xoá bài kiểm tra", err);
  }
};

module.exports = deleteQuiz;
