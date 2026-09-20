const { pool } = require("../../config/db.config");
const { sendServerError } = require("../../utils/errorResponse");
const { parsePositiveInt } = require("../../utils/parseId");
const { resolveActorUid } = require("../../middleware/actor");

const checkEnrollStatus = async (req, res) => {
  const course_id = parsePositiveInt(req.params.course_id);

  if (!course_id) {
    return res.status(400).json({ error: "course_id không hợp lệ" });
  }

  // Chỉ được kiểm tra trạng thái đăng ký của chính mình (admin kiểm tra được của người khác)
  const uid = resolveActorUid(req, res, req.params.uid);
  if (!uid) return;

  try {
    // Kiểm tra khóa học
    const courseResult = await pool.query(
      "SELECT course_id FROM courses WHERE course_id = $1",
      [course_id]
    );

    if (courseResult.rows.length === 0) {
      return res.status(404).json({ error: "Khóa học không tồn tại" });
    }

    // Kiểm tra đăng ký
    const enrollResult = await pool.query(
      "SELECT * FROM enrollments WHERE user_uid = $1 AND course_id = $2",
      [uid, course_id]
    );

    if (enrollResult.rows.length > 0) {
      return res.status(200).json({ enrolled: true });
    } else {
      return res.status(200).json({ enrolled: false });
    }
  } catch (err) {
    sendServerError(res, "Lỗi kiểm tra đăng ký", err);
  }
};

module.exports = checkEnrollStatus;
