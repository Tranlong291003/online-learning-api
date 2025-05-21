// controllers/bookmarks/deleteBookmark.js
const { sql, poolPromise } = require("../../config/db.config");

const deleteBookmark = async (req, res) => {
  try {
    // Lấy bookmarkId và userUid (không dấu _) từ body
    const { bookmarkId, userUid } = req.body;
    if (!bookmarkId || !userUid) {
      return res
        .status(400)
        .json({ error: "bookmarkId và userUid là bắt buộc" });
    }

    const pool = await poolPromise;

    // Kiểm tồn tại & chủ sở hữu
    const check = await pool.request().input("bookmarkId", sql.Int, bookmarkId)
      .query(`
        SELECT user_uid
        FROM bookmarks
        WHERE bookmark_id = @bookmarkId
      `);

    if (check.recordset.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy bookmark" });
    }
    if (check.recordset[0].user_uid !== userUid) {
      return res
        .status(403)
        .json({ error: "Bạn không có quyền xóa bookmark này" });
    }

    // Xóa
    await pool.request().input("bookmarkId", sql.Int, bookmarkId).query(`
        DELETE FROM bookmarks
        WHERE bookmark_id = @bookmarkId
      `);

    return res.status(200).json({ data: null });
  } catch (err) {
    return res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

module.exports = deleteBookmark;
