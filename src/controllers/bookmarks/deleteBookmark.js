const { pool } = require("../../config/db.config");
const { sendServerError } = require("../../utils/errorResponse");
const { resolveActorUid } = require("../../middleware/actor");
const { parsePositiveInt } = require("../../utils/parseId");

const deleteBookmark = async (req, res) => {
  try {
    const rawBookmarkId = req.body.bookmarkId;
    if (!rawBookmarkId) {
      return res.status(400).json({ error: "bookmarkId là bắt buộc" });
    }

    // bookmark_id là cột integer; "abc" sẽ khiến PostgreSQL ném lỗi → 500.
    const bookmarkId = parsePositiveInt(rawBookmarkId);
    if (!bookmarkId) {
      return res.status(400).json({ error: "bookmarkId phải là số nguyên dương" });
    }

    // Lấy uid từ token; chỉ admin mới được xóa bookmark thay người khác
    const userUid = resolveActorUid(req, res, req.body.userUid || req.body.uid);
    if (!userUid) return;

    // Kiểm tra tồn tại và chủ sở hữu.
    //
    // Admin xoá hộ người khác được, nên phải so với actor trong token. Trước
    // đây so với userUid (uid đích) nên admin luôn bị 403 khi xoá hộ.
    const check = await pool.query(
      "SELECT user_uid FROM bookmarks WHERE bookmark_id = $1",
      [bookmarkId]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy bookmark" });
    }
    const actorUid = req.user && req.user.uid;
    if (req.user.role !== "admin" && String(check.rows[0].user_uid) !== String(actorUid)) {
      return res.status(403).json({ error: "Bạn không có quyền xóa bookmark này" });
    }

    // Xóa
    await pool.query("DELETE FROM bookmarks WHERE bookmark_id = $1", [bookmarkId]);

    return res.status(200).json({ data: null });
  } catch (err) {
    return sendServerError(res, "Lỗi server", err);
  }
};

module.exports = deleteBookmark;
