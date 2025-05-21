// controllers/reviews/deleteReview.js
const { sql, poolPromise } = require("../../config/db.config");

const deleteReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { user_uid } = req.body;

    if (!user_uid) {
      return res.status(400).json({ error: "user_uid không được bỏ trống" });
    }

    const pool = await poolPromise;

    // 1. Kiểm tra tồn tại và chủ sở hữu
    const chk = await pool
      .request()
      .input("reviewId", sql.Int, reviewId)
      .query(
        `SELECT user_uid
         FROM course_reviews
         WHERE review_id = @reviewId`
      );
    if (chk.recordset.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy review" });
    }
    if (chk.recordset[0].user_uid !== user_uid) {
      return res
        .status(403)
        .json({ error: "Bạn không có quyền xóa review này" });
    }

    // 2. Thực hiện xóa
    await pool
      .request()
      .input("reviewId", sql.Int, reviewId)
      .query(`DELETE FROM course_reviews WHERE review_id = @reviewId`);

    return res.status(200).json({ message: "✅ Xóa thành công" });
  } catch (err) {
    return res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

module.exports = deleteReview;
