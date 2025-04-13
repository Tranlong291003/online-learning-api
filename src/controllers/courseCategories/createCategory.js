// controllers/courseCategories/createCategory.js
const { sql, poolConnect, pool } = require("../../config/db.config");

const createCategory = async (req, res) => {
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

module.exports = createCategory;
