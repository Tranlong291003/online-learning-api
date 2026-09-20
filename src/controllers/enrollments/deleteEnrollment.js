const { pool } = require("../../config/db.config");
const { parsePositiveInt } = require("../../utils/parseId");
const { sendServerError } = require("../../utils/errorResponse");

const deleteEnrollment = async (req, res) => {
  try {
    const enrollment_id = parsePositiveInt(req.params.enrollment_id);

  if (!enrollment_id) {
    return res.status(400).json({ error: "enrollment_id không hợp lệ" });
  }

    // Chỉ chủ sở hữu hoặc admin mới được huỷ đăng ký
    const actorUid = req.user && req.user.uid;
    if (!actorUid) {
      return res.status(401).json({ error: "Không xác định được người dùng từ token" });
    }

    const owner = await pool.query(
      "SELECT user_uid FROM enrollments WHERE enrollment_id = $1",
      [enrollment_id]
    );

    if (owner.rows.length === 0) {
      return res.status(404).json({ error: "❌ Không tìm thấy đăng ký để huỷ" });
    }

    if (req.user.role !== "admin" && owner.rows[0].user_uid !== actorUid) {
      return res.status(403).json({ error: "Bạn không có quyền huỷ đăng ký của người khác" });
    }

    const result = await pool.query(
      "DELETE FROM enrollments WHERE enrollment_id = $1 RETURNING enrollment_id",
      [enrollment_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "❌ Không tìm thấy đăng ký để huỷ" });
    }

    res.json({ message: "🗑️ Huỷ đăng ký thành công" });
  } catch (err) {
    sendServerError(res, "Lỗi huỷ đăng ký", err);
  }
};

module.exports = deleteEnrollment;
