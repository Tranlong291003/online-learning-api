const { pool } = require("../../config/db.config");
const { sendServerError } = require("../../utils/errorResponse");
const { resolveActorUid } = require("../../middleware/actor");
const { parsePositiveInt } = require("../../utils/parseId");

const updateCategory = async (req, res) => {
  try {
    const category_id = parsePositiveInt(req.params.category_id);
    const { name, description } = req.body;
    const iconFile = req.file;

    if (!category_id) {
      return res.status(400).json({ error: "category_id không hợp lệ" });
    }
    if (!name) return res.status(400).json({ error: "Tên danh mục không được bỏ trống" });

    // Lấy uid từ token; chỉ admin mới được thao tác thay người khác
    const uid = resolveActorUid(req, res, req.body.uid);
    if (!uid) return;

    // Kiểm quyền
    const roleResult = await pool.query(
      "SELECT role FROM users WHERE uid = $1",
      [uid]
    );
    const user = roleResult.rows[0];
    if (!user) return res.status(404).json({ error: "Không tìm thấy người dùng" });
    if (user.role !== "admin" && user.role !== "mentor") {
      return res.status(403).json({ error: "Bạn không có quyền thay đổi danh mục" });
    }

    // Update. Icon cũ không bị xoá: bản ghi mới trong uploaded_files nằm ở
    // đường dẫn ngẫu nhiên khác nên không ghi đè, và giữ lại file cũ tránh làm
    // hỏng ảnh của bản ghi khác đang trỏ tới cùng đường dẫn.
    let updateResult;
    if (iconFile) {
      const newIcon = iconFile.publicPath;
      updateResult = await pool.query(
        `UPDATE course_categories SET name = $1, description = $2, icon = $3, updated_at = NOW()
         WHERE category_id = $4
         RETURNING category_id, name, description, icon`,
        [name, description, newIcon, category_id]
      );
    } else {
      updateResult = await pool.query(
        `UPDATE course_categories SET name = $1, description = $2, updated_at = NOW()
         WHERE category_id = $3
         RETURNING category_id, name, description, icon`,
        [name, description, category_id]
      );
    }

    if (updateResult.rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy danh mục" });
    }

    return res.status(200).json({
      message: "✅ Cập nhật thành công",
      data: updateResult.rows[0],
    });
  } catch (err) {
    return sendServerError(res, "❌ Lỗi cập nhật", err);
  }
};

module.exports = updateCategory;
