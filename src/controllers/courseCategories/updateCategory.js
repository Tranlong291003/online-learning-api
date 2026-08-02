const { pool } = require("../../config/db.config");
const fs = require("fs");
const path = require("path");

const removeOldIcon = (oldIconPath) => {
  if (!oldIconPath) return;
  const fullPath = path.join(__dirname, "../public", oldIconPath);
  if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
};

const updateCategory = async (req, res) => {
  try {
    const { category_id } = req.params;
    const { name, description, uid } = req.body;
    const iconFile = req.file;

    if (!name) return res.status(400).json({ error: "Tên danh mục không được bỏ trống" });
    if (!uid) return res.status(400).json({ error: "UID không được bỏ trống" });

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

    // Xóa icon cũ nếu có file mới
    if (iconFile) {
      const oldResult = await pool.query(
        "SELECT icon FROM course_categories WHERE category_id = $1",
        [category_id]
      );
      const oldIcon = oldResult.rows[0]?.icon;
      if (oldIcon) removeOldIcon(oldIcon);
    }

    // Update
    if (iconFile) {
      const newIcon = `/uploads/categories/${iconFile.filename}`;
      await pool.query(
        "UPDATE course_categories SET name = $1, description = $2, icon = $3, updated_at = NOW() WHERE category_id = $4",
        [name, description, newIcon, category_id]
      );
    } else {
      await pool.query(
        "UPDATE course_categories SET name = $1, description = $2, updated_at = NOW() WHERE category_id = $3",
        [name, description, category_id]
      );
    }

    return res.status(200).json({ message: "✅ Cập nhật thành công" });
  } catch (err) {
    return res.status(500).json({ error: "❌ Lỗi cập nhật: " + err.message });
  }
};

module.exports = updateCategory;
