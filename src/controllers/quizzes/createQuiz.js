const { pool } = require("../../config/db.config");
const { parsePositiveInt } = require("../../utils/parseId");
const { sendServerError } = require("../../utils/errorResponse");
const { resolveActorUid } = require("../../middleware/actor");
const { canManageCourse } = require("../../utils/access");

const createQuiz = async (req, res) => {
  const { course_id, title, type, time_limit, attempt_limit } = req.body;

  if (!course_id || !title) {
    return res.status(400).json({ error: "Thiếu thông tin khóa học hoặc tiêu đề" });
  }

  // Các cột này là integer trong CSDL. Nếu client gửi chuỗi ("abc"), PostgreSQL
  // ném "invalid input syntax for type integer" → 500, trong khi lỗi thật là
  // dữ liệu client gửi sai nên phải là 400.
  const timeLimit = parsePositiveInt(time_limit);
  const attemptLimit = parsePositiveInt(attempt_limit);
  if (time_limit != null && time_limit !== "" && timeLimit === null) {
    return res.status(400).json({ error: "time_limit phải là số nguyên dương" });
  }
  if (attempt_limit != null && attempt_limit !== "" && attemptLimit === null) {
    return res.status(400).json({ error: "attempt_limit phải là số nguyên dương" });
  }

  // Lấy uid từ token; chỉ admin mới được thao tác thay người khác
  const uid = resolveActorUid(req, res, req.body.uid);
  if (!uid) return;

  try {
    // Kiểm tra vai trò
    const roleResult = await pool.query("SELECT role FROM users WHERE uid = $1", [uid]);
    const role = roleResult.rows[0]?.role;

    if (role !== "admin" && role !== "mentor") {
      return res.status(403).json({ error: "Bạn không có quyền tạo bài kiểm tra" });
    }

    // Kiểm tra khóa học tồn tại VÀ thuộc quyền người gọi. Nếu bỏ bước kiểm tra
    // tồn tại, course_id lạ sẽ vi phạm khoá ngoại và trả 500 kèm tên constraint
    // nội bộ; nếu bỏ bước kiểm tra sở hữu, mentor bất kỳ tạo được quiz trong
    // khoá học của mentor khác.
    const access = await canManageCourse(course_id, req.user);
    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }

    // Tạo quiz
    const result = await pool.query(
      `INSERT INTO quizzes (course_id, title, type, time_limit, attempt_limit, creator_uid, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING *`,
      [course_id, title, type || "trac_nghiem", timeLimit, attemptLimit, uid]
    );

    const quiz = result.rows[0];
    if (quiz?.creator_uid) {
      quiz.creator_uid = quiz.creator_uid.trim();
    }

    res.status(201).json({
      message: "Tạo bài kiểm tra thành công",
      data: quiz,
    });
  } catch (err) {
    sendServerError(res, "Lỗi khi tạo bài kiểm tra", err);
  }
};

module.exports = createQuiz;
