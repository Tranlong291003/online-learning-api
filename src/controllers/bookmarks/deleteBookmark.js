const { pool } = require("../../config/db.config");
const { resolveActorUid } = require("../../middleware/actor");

const deleteBookmark = async (req, res) => {
  try {
    const { bookmarkId } = req.body;
    if (!bookmarkId) {
      return res.status(400).json({ error: "bookmarkId là bắt buộc" });
    }

    // Lấy uid từ token; chỉ admin mới được xóa bookmark thay người khác
    const userUid = resolveActorUid(req, res, req.body.userUid || req.body.uid);
    if (!userUid) return;

    // Kiểm tra tồn tại và chủ sở hữu
    const check = await pool.query(
      "SELECT user_uid FROM bookmarks WHERE bookmark_id = $1",
      [bookmarkId]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy bookmark" });
    }
    if (check.rows[0].user_uid !== userUid) {
      return res.status(403).json({ error: "Bạn không có quyền xóa bookmark này" });
    }

    // Xóa
    await pool.query("DELETE FROM bookmarks WHERE bookmark_id = $1", [bookmarkId]);

    return res.status(200).json({ data: null });
  } catch (err) {
    return res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

module.exports = deleteBookmark;
