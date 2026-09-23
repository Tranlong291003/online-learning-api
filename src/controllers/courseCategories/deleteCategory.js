const { pool } = require("../../config/db.config");
const { deleteFiles } = require("../../services/fileStorage");
const { parsePositiveInt } = require("../../utils/parseId");
const { sendServerError } = require("../../utils/errorResponse");
const { resolveActorUid } = require("../../middleware/actor");

const deleteCategory = async (req, res) => {
  try {
    const category_id = parsePositiveInt(req.params.category_id);

  if (!category_id) {
    return res.status(400).json({ error: "category_id không hợp lệ" });
  }

    // Lấy uid từ token; chỉ admin mới được thao tác thay người khác
    const uid = resolveActorUid(req, res, req.body.uid);
    if (!uid) return;

    // Kiểm tra role
    const roleResult = await pool.query(
      "SELECT role FROM users WHERE uid = $1",
      [uid]
    );

    if (roleResult.rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy người dùng" });
    }

    const userRole = roleResult.rows[0]?.role;
    if (userRole !== "admin" && userRole !== "mentor") {
      return res.status(403).json({ error: "Bạn không có quyền xóa danh mục" });
    }

    // Xóa. Trả về luôn `icon` để dọn file sau khi xoá xong — nếu không, mỗi lần
    // xoá danh mục sẽ để lại file mồ côi trong uploaded_files.
    const result = await pool.query(
      "DELETE FROM course_categories WHERE category_id = $1 RETURNING category_id, icon",
      [category_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "❌ Không tìm thấy danh mục để xoá" });
    }

    await deleteFiles([result.rows[0].icon]);

    res.status(200).json({ message: "🗑️ Xóa danh mục thành công" });
  } catch (err) {
    if (err.code === "23503") {
      return res.status(409).json({ error: "Không thể xoá danh mục đang có khóa học" });
    }
    sendServerError(res, "❌ Lỗi xoá danh mục", err);
  }
};

module.exports = deleteCategory;
