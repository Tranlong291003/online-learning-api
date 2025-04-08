const { sql, poolConnect, pool } = require("../config/db.config");

exports.getAllCategories = async (req, res) => {
  try {
    await poolConnect;
    const request = new sql.Request(pool);
    const result = await request.query("SELECT * FROM course_categories");
    res
      .status(200)
      .json({ message: "Lấy danh mục thành công", data: result.recordset });
  } catch (err) {
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

exports.createCategory = async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name)
      return res
        .status(400)
        .json({ error: "Tên danh mục không được bỏ trống" });

    await poolConnect;
    const request = new sql.Request(pool);
    request.input("name", sql.NVarChar, name);
    request.input("desc", sql.NVarChar, description);
    await request.query(
      "INSERT INTO course_categories (name, description, updated_at) VALUES (@name, @desc, GETDATE())"
    );

    res.status(201).json({ message: "✅ Tạo danh mục thành công" });
  } catch (err) {
    res.status(500).json({ error: "❌ Lỗi tạo danh mục: " + err.message });
  }
};

exports.updateCategory = async (req, res) => {
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

exports.deleteCategory = async (req, res) => {
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
