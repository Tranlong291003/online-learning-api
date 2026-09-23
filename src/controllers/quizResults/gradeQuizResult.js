const { pool } = require("../../config/db.config");
const { parsePositiveInt } = require("../../utils/parseId");
const { sendServerError } = require("../../utils/errorResponse");
const { resolveActorUid } = require("../../middleware/actor");

const gradeQuizResult = async (req, res) => {
  // Tham số phải là số nguyên dương; chuỗi lạ sẽ khiến PostgreSQL ném lỗi
  // "invalid input syntax for type bigint" → 500 thay vì 400.
  const result_id = parsePositiveInt(req.params.result_id);
  const { explanation, score } = req.body;

  if (!result_id) {
    return res.status(400).json({ error: "result_id không hợp lệ" });
  }

  if (!explanation || score === undefined) {
    return res.status(400).json({ error: "Thiếu thông tin chấm điểm hoặc giải thích" });
  }

  // score là cột số thực trong CSDL. Chuỗi không phải số ("abc") sẽ khiến
  // PostgreSQL ném lỗi cú pháp → 500, trong khi lỗi thật là client gửi sai.
  const scoreValue = Number(score);
  if (!Number.isFinite(scoreValue)) {
    return res.status(400).json({ error: "score phải là một số" });
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

    // Mentor chỉ được chấm bài thuộc khoá học do chính mình dạy.
    //
    // Trước đây câu UPDATE không có điều kiện sở hữu nào, nên bất kỳ mentor nào
    // cũng ghi đè được điểm và nhận xét của mọi bài nộp trong hệ thống.
    // Điều kiện được đặt ngay trong câu UPDATE (thay vì SELECT rồi UPDATE) để
    // không có khe hở giữa hai bước.
    const ownershipJoin = userRole === "admin"
      ? ""
      : `AND EXISTS (
           SELECT 1 FROM quizzes q
           JOIN courses c ON c.course_id = q.course_id
           WHERE q.quiz_id = quiz_results.quiz_id
             AND c.instructor_uid = $5
         )`;

    const params = [explanation, scoreValue, graded_by, result_id];
    if (userRole !== "admin") params.push(uid);

    const result = await pool.query(
      `UPDATE quiz_results
       SET explanation = $1, score = $2, status = 'da_cham', graded_by = $3, graded_at = NOW()
       WHERE result_id = $4 ${ownershipJoin}
       RETURNING result_id`,
      params
    );

    if (result.rows.length === 0 && userRole !== "admin") {
      // Phân biệt "không có bài" với "bài của khoá học người khác" để thông báo
      // rõ ràng, nhưng vẫn không xác nhận sự tồn tại của bài nộp.
      const exists = await pool.query(
        "SELECT 1 FROM quiz_results WHERE result_id = $1",
        [result_id]
      );
      if (exists.rows.length > 0) {
        return res.status(403).json({
          error: "Bạn không có quyền chấm điểm bài kiểm tra của khoá học người khác",
        });
      }
    }

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
