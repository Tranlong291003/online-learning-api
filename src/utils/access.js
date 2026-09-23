/**
 * Trả lời câu hỏi "ai được phép thao tác trên một khoá học".
 *
 * Quy tắc nghiệp vụ của hệ thống:
 *   - admin  : toàn quyền.
 *   - mentor : chỉ trên khoá học do chính mình dạy.
 *   - user   : chỉ đọc.
 *
 * Trước đây mỗi controller tự viết lại phép so sánh này, nên chỉ cần một chỗ
 * quên là hở quyền. Ví dụ đã quan sát được: `PUT /api/questions/update/:id`
 * không hề kiểm tra chủ sở hữu, nên mentor02 sửa/xoá được câu hỏi trong quiz
 * của mentor01 (endpoint xoá thì có kiểm tra, endpoint sửa thì không).
 *
 * Gom về một chỗ để lần sau không phải suy luận lại quy tắc ở từng controller.
 */
const { pool } = require("../config/db.config");

/** Admin luôn được phép; mentor chỉ khi là chủ sở hữu. */
function canManage(userRole, ownerUid, actorUid) {
  if (userRole === "admin") return true;
  if (userRole === "mentor") return String(ownerUid) === String(actorUid);
  return false;
}

/**
 * Kiểm tra quyền quản lý một khoá học.
 *
 * @param {number|string} courseId
 * @param {{uid: string, role: string}} user Lấy từ `req.user`.
 * @returns {Promise<{ok: true, course: object} | {ok: false, status: number, error: string}>}
 */
async function canManageCourse(courseId, user) {
  const result = await pool.query(
    "SELECT course_id, instructor_uid, title, status FROM courses WHERE course_id = $1",
    [courseId]
  );

  if (result.rows.length === 0) {
    return { ok: false, status: 404, error: "Không tìm thấy khóa học" };
  }

  const course = result.rows[0];

  if (!canManage(user.role, course.instructor_uid, user.uid)) {
    return {
      ok: false,
      status: 403,
      error: "Bạn không có quyền thao tác trên khóa học của người khác",
    };
  }

  return { ok: true, course };
}

/**
 * Kiểm tra quyền quản lý một bài kiểm tra (quiz).
 *
 * @param {number|string} quizId
 * @param {{uid: string, role: string}} user
 * @returns {Promise<{ok: true, quiz: object} | {ok: false, status: number, error: string}>}
 */
async function canManageQuiz(quizId, user) {
  const result = await pool.query(
    "SELECT quiz_id, course_id, creator_uid, type FROM quizzes WHERE quiz_id = $1",
    [quizId]
  );

  if (result.rows.length === 0) {
    return { ok: false, status: 404, error: "Không tìm thấy bài kiểm tra" };
  }

  const quiz = result.rows[0];

  if (!canManage(user.role, quiz.creator_uid, user.uid)) {
    return {
      ok: false,
      status: 403,
      error: "Bạn không có quyền thao tác trên bài kiểm tra của người khác",
    };
  }

  return { ok: true, quiz };
}

/**
 * Kiểm tra quyền quản lý một câu hỏi.
 *
 * Bảng `quiz_questions` không có cột chủ sở hữu — quyền được suy ra từ quiz
 * chứa câu hỏi (`quizzes.creator_uid`).
 *
 * @param {number|string} questionId
 * @param {{uid: string, role: string}} user
 * @returns {Promise<{ok: true, question: object, quiz: object} | {ok: false, status: number, error: string}>}
 */
async function canManageQuestion(questionId, user) {
  const result = await pool.query(
    `SELECT qq.question_id, qq.quiz_id, q.creator_uid, q.type AS quiz_type
     FROM quiz_questions qq
     JOIN quizzes q ON q.quiz_id = qq.quiz_id
     WHERE qq.question_id = $1`,
    [questionId]
  );

  if (result.rows.length === 0) {
    return { ok: false, status: 404, error: "Câu hỏi không tồn tại hoặc đã bị xóa." };
  }

  const row = result.rows[0];

  if (!canManage(user.role, row.creator_uid, user.uid)) {
    return {
      ok: false,
      status: 403,
      error: "Bạn không có quyền thao tác trên câu hỏi của người khác",
    };
  }

  return { ok: true, question: row, quiz: row };
}

module.exports = { canManage, canManageCourse, canManageQuiz, canManageQuestion };
