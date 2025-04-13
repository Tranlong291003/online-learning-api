// controllers/courseCategories/updateCategory.js
const { sql, poolConnect, pool } = require("../../config/db.config");

const updateCategory = async (req, res) => {
  try {
    const { category_id } = req.params;
    const { name, description } = req.body;

    if (!name)
      return res
        .status(400)
        .json({ error: "Tên danh mục không được bỏ trống" });

    await poolConnect;
    const request = new sql.Request(pool);
    request.input("category_id", sql.Int, category_id);
    request.input("name", sql.NVarChar, name);
    request.input("desc", sql.NVarChar, description);
    const result = await request.query(
      "UPDATE course_categories SET name = @name, description = @desc, updated_at = GETDATE() WHERE category_id = @category_id"
    );

    res.status(200).json({
      message: "✅ Cập nhật thành công",
      rowsAffected: result.rowsAffected,
    });
  } catch (err) {
    res.status(500).json({ error: "❌ Lỗi cập nhật: " + err.message });
  }
};

module.exports = updateCategory;
