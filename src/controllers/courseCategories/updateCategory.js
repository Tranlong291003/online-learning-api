// controllers/courseCategories/updateCategory.js
const { sql, poolPromise } = require("../../config/db.config");
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

    if (!name)
      return res
        .status(400)
        .json({ error: "Tên danh mục không được bỏ trống" });
    if (!uid) return res.status(400).json({ error: "UID không được bỏ trống" });

    const pool = await poolPromise;

    // 1. Kiểm quyền
    const reqRole = new sql.Request(pool);
    reqRole.input("uid", sql.NVarChar, uid);
    const roleQ = await reqRole.query(
      "SELECT role FROM users WHERE uid = @uid"
    );
    const user = roleQ.recordset[0];
    if (!user)
      return res.status(404).json({ error: "Không tìm thấy người dùng" });
    if (user.role !== "admin" && user.role !== "giang_vien")
      return res
        .status(403)
        .json({ error: "Bạn không có quyền thay đổi danh mục" });

    // 2. Lấy và xóa icon cũ (nếu có file mới)
    if (iconFile) {
      const reqSelect = new sql.Request(pool);
      reqSelect.input("category_id", sql.Int, category_id);
      const sel = await reqSelect.query(
        "SELECT icon FROM course_categories WHERE category_id = @category_id"
      );
      const oldIcon = sel.recordset[0]?.icon;
      if (oldIcon) removeOldIcon(oldIcon);
    }

    // 3. Cập nhật
    const reqUpd = new sql.Request(pool);
    reqUpd.input("category_id", sql.Int, category_id);
    reqUpd.input("name", sql.NVarChar, name);
    reqUpd.input("desc", sql.NVarChar, description);

    const sets = [
      "name = @name",
      "description = @desc",
      "updated_at = GETDATE()",
    ];
    if (iconFile) {
      const newIcon = `/uploads/categories/${iconFile.filename}`;
      reqUpd.input("icon", sql.NVarChar, newIcon);
      sets.push("icon = @icon");
    }

    const sqlUpdate = `
      UPDATE course_categories
      SET ${sets.join(", ")}
      WHERE category_id = @category_id
    `;
    await reqUpd.query(sqlUpdate);

    return res.status(200).json({ message: "✅ Cập nhật thành công" });
  } catch (err) {
    return res.status(500).json({ error: "❌ Lỗi cập nhật: " + err.message });
  }
};

module.exports = updateCategory;
