// controllers/reviews/createReview.js
const { sql, poolPromise } = require("../../config/db.config");

const createReview = async (req, res) => {
  try {
    const { course_id, user_uid, rating, comment } = req.body;
    if (!course_id || !user_uid || rating == null) {
      return res
        .status(400)
        .json({ error: "course_id, user_uid và rating không được bỏ trống" });
    }

    const pool = await poolPromise;

    // 1. Kiểm tra xem user đã review khóa này chưa
    const check = await pool
      .request()
      .input("course_id", sql.Int, course_id)
      .input("user_uid", sql.NVarChar, user_uid).query(`
        SELECT 1
        FROM course_reviews
        WHERE course_id = @course_id
          AND user_uid  = @user_uid
      `);
    if (check.recordset.length > 0) {
      return res.status(400).json({ error: "Bạn đã review khóa học này rồi" });
    }

    // 2. Chèn review mới
    const result = await pool
      .request()
      .input("course_id", sql.Int, course_id)
      .input("user_uid", sql.NVarChar, user_uid)
      .input("rating", sql.TinyInt, rating)
      .input("comment", sql.NVarChar, comment || null)
      .input("created_at", sql.DateTime, new Date()).query(`
        INSERT INTO course_reviews
          (course_id, user_uid, rating, comment, created_at)
        OUTPUT INSERTED.review_id
        VALUES
          (@course_id, @user_uid, @rating, @comment, @created_at)
      `);

    const newId = result.recordset[0].review_id;
    return res.status(201).json({ data: { review_id: newId } });
  } catch (err) {
    return res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

module.exports = createReview;
