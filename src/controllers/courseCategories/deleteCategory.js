// controllers/courseCategories/deleteCategory.js
const { sql, poolConnect, pool } = require("../../config/db.config");

const deleteCategory = async (req, res) => {
  try {
    const { category_id } = req.params;

    await poolConnect;
    const request = new sql.Request(pool);
    request.input("category_id", sql.Int, category_id);
    const result = await request.query(
      "DELETE FROM course_categories WHERE category_id = @category_id"
    );

    if (result.rowsAffected[0] === 0) {
      return res
        .status(404)
        .json({ error: "❌ Không tìm thấy danh mục để xoá" });
    }

    res.status(200).json({ message: "🗑️ Xóa danh mục thành công" });
  } catch (err) {
    res.status(500).json({ error: "❌ Lỗi xoá danh mục: " + err.message });
  }
};

module.exports = deleteCategory;
