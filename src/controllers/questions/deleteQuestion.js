const { parsePositiveInt } = require("../../utils/parseId");
const { pool } = require("../../config/db.config");
const { sendServerError } = require("../../utils/errorResponse");
const { resolveActorUid } = require("../../middleware/actor");

const deleteQuestion = async (req, res) => {
  const question_id = parsePositiveInt(req.params.question_id);
  
  // Tham số phải là số nguyên dương. Nếu để nguyên chuỗi, PostgreSQL
  // ném "invalid input syntax for type integer" và API trả 500 — trong khi
  // lỗi thật là "client gửi sai" nên phải là 400.
  if (!question_id) {
    return res.status(400).json({ error: "question_id không hợp lệ" });
  }

  // Lấy uid từ token; chỉ admin mới được thao tác thay người khác
  const uid = resolveActorUid(req, res, req.body.uid);
  if (!uid) return;

  try {
    // Kiểm tra quyền
    const roleResult = await pool.query("SELECT role FROM users WHERE uid = $1", [uid]);
    const userRole = roleResult.rows[0]?.role;

    if (userRole !== "admin" && userRole !== "mentor") {
      return res.status(403).json({ error: "Bạn không có quyền xóa câu hỏi" });
    }

    // Mentor chỉ được xoá câu hỏi thuộc quiz do mình tạo (giống deleteLesson/deleteQuiz).
    // Không kiểm tra thì mentor bất kỳ xoá được câu hỏi trong quiz của mentor khác.
    if (userRole === "mentor") {
      const ownerResult = await pool.query(
        `SELECT q.creator_uid
           FROM quiz_questions qq
           JOIN quizzes q ON q.quiz_id = qq.quiz_id
          WHERE qq.question_id = $1`,
        [question_id]
      );
      if (ownerResult.rows.length === 0) {
        return res.status(404).json({ error: "Câu hỏi không tồn tại" });
      }
      if (ownerResult.rows[0].creator_uid !== uid) {
        return res.status(403).json({ error: "Bạn chỉ được xóa câu hỏi trong quiz do bạn tạo" });
      }
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
    sendServerError(res, "Lỗi khi xóa câu hỏi", err);
  }
};

module.exports = deleteQuestion;
