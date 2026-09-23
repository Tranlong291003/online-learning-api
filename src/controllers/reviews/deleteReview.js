const { parsePositiveInt } = require("../../utils/parseId");
const { pool } = require("../../config/db.config");
const { sendServerError } = require("../../utils/errorResponse");
const { resolveActorUid } = require("../../middleware/actor");

const deleteReview = async (req, res) => {
  try {
    const reviewId = parsePositiveInt(req.params.reviewId);
    
    // Tham số phải là số nguyên dương. Nếu để nguyên chuỗi, PostgreSQL
    // ném "invalid input syntax for type integer" và API trả 500 — trong khi
    // lỗi thật là "client gửi sai" nên phải là 400.
    if (!reviewId) {
      return res.status(400).json({ error: "reviewId không hợp lệ" });
    }

    // Lấy uid từ token; chỉ admin mới được xoá review thay người khác
    const user_uid = resolveActorUid(req, res, req.body.user_uid);
    if (!user_uid) return;

    // Kiểm tra tồn tại và chủ sở hữu
    const chk = await pool.query(
      "SELECT user_uid FROM course_reviews WHERE review_id = $1",
      [reviewId]
    );
    if (chk.rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy review" });
    }
    if (chk.rows[0].user_uid !== user_uid) {
      return res.status(403).json({ error: "Bạn không có quyền xóa review này" });
    }

    // Xóa
    await pool.query("DELETE FROM course_reviews WHERE review_id = $1", [reviewId]);

    return res.status(200).json({ message: "✅ Xóa thành công" });
  } catch (err) {
    return sendServerError(res, "Lỗi server", err);
  }
};

module.exports = deleteReview;
