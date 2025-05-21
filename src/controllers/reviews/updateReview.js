// controllers/reviews/updateReview.js
const { sql, poolPromise } = require("../../config/db.config");

const updateReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { user_uid, rating, comment } = req.body;

    if (!user_uid) {
      return res.status(400).json({ error: "user_uid không được bỏ trống" });
    }
    if (rating == null && comment == null) {
      return res.status(400).json({ error: "Không có dữ liệu để cập nhật" });
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
        .json({ error: "Bạn không có quyền cập nhật review này" });
    }

    // 2. Xây dựng câu lệnh UPDATE
    const sets = [];
    const reqDb = pool.request().input("reviewId", sql.Int, reviewId);

    if (rating != null) {
      sets.push("rating = @rating");
      reqDb.input("rating", sql.TinyInt, rating);
    }
    if (comment != null) {
      sets.push("comment = @comment");
      reqDb.input("comment", sql.NVarChar, comment);
    }
    sets.push("updated_at = GETDATE()");

    const sqlUpdate = `
      UPDATE course_reviews
      SET ${sets.join(", ")}
      WHERE review_id = @reviewId
    `;

    const result = await reqDb.query(sqlUpdate);

    return res.status(200).json({ message: "✅ Cập nhật thành công" });
  } catch (err) {
    return res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

module.exports = updateReview;
