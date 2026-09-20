const { pool } = require("../../config/db.config");
const { sendServerError } = require("../../utils/errorResponse");
const { resolveActorUid } = require("../../middleware/actor");

const gradeQuizResult = async (req, res) => {
  const { result_id } = req.params;
  const { explanation, score } = req.body;

  if (!explanation || score === undefined) {
    return res.status(400).json({ error: "Thiếu thông tin chấm điểm hoặc giải thích" });
  }

  // Lấy uid từ token; chỉ admin mới được thao tác thay người khác
  const uid = resolveActorUid(req, res, req.body.uid);
  if (!uid) return;

  try {
    // Lấy thông tin người chấm
    const userResult = await pool.query("SELECT id, role FROM users WHERE uid = $1", [uid]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy người chấm điểm" });
    }

    // Cột thật trong DB là quiz_results.graded_by (int4, FK -> users.id),
    // KHÔNG phải graded_by_uid (text). Lưu id số, không lưu uid dạng chuỗi.
    const graded_by = userResult.rows[0].id;
    const userRole = userResult.rows[0].role;

    if (userRole !== "admin" && userRole !== "mentor") {
      return res.status(403).json({ error: "Bạn không có quyền chấm điểm bài kiểm tra" });
    }

    // Update
    const result = await pool.query(
      `UPDATE quiz_results
       SET explanation = $1, score = $2, status = 'da_cham', graded_by = $3, graded_at = NOW()
       WHERE result_id = $4
       RETURNING result_id`,
      [explanation, score, graded_by, result_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Kết quả không tồn tại" });
    }

    res.status(200).json({ message: "Chấm điểm bài kiểm tra thành công" });
  } catch (err) {
    console.error(err);
    sendServerError(res, "Lỗi khi chấm điểm bài kiểm tra", err);
  }
};

module.exports = gradeQuizResult;
