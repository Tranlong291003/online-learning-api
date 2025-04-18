// controllers/courseCategories/getAllCategories.js
const { sql, poolConnect, pool } = require("../../config/db.config");

const getAllCategories = async (req, res) => {
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
module.exports = getAllCategories;
