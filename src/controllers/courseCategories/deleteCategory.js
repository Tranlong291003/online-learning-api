const { pool } = require("../../config/db.config");
const { resolveActorUid } = require("../../middleware/actor");

const deleteCategory = async (req, res) => {
  try {
    const { category_id } = req.params;

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

    // Xóa
    const result = await pool.query(
      "DELETE FROM course_categories WHERE category_id = $1 RETURNING category_id",
      [category_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "❌ Không tìm thấy danh mục để xoá" });
    }

    res.status(200).json({ message: "🗑️ Xóa danh mục thành công" });
  } catch (err) {
    if (err.code === "23503") {
      return res.status(409).json({ error: "Không thể xoá danh mục đang có khóa học" });
    }
    res.status(500).json({ error: "❌ Lỗi xoá danh mục: " + err.message });
  }
};

module.exports = deleteCategory;
