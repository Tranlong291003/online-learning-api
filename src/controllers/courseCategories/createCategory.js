// controllers/courseCategories/createCategory.js
const { sql, poolConnect, pool } = require("../../config/db.config");

const createCategory = async (req, res) => {
  try {
    const { name, description } = req.body;
    const { uid } = req.user; // Giả sử UID của người dùng có trong req.user (ví dụ: thông qua xác thực JWT)

    if (!name)
      return res
        .status(400)
        .json({ error: "Tên danh mục không được bỏ trống" });

    // Kết nối đến cơ sở dữ liệu
    await poolConnect;
    const request = new sql.Request(pool);

    // Kiểm tra vai trò của người dùng
    const roleQuery = await request.query(
      `SELECT role FROM users WHERE firebase_uid = @uid`
    );

    const userRole = roleQuery.recordset[0]?.role; // Giả sử kết quả trả về là một mảng và role là trường trong đó

    if (userRole !== "giang_vien" && userRole !== "admin") {
      return res.status(403).json({ error: "Bạn không có quyền tạo danh mục" });
    }

    // Nếu role hợp lệ, tiếp tục tạo danh mục
    request.input("name", sql.NVarChar, name);
    request.input("desc", sql.NVarChar, description);
    await request.query(
      "INSERT INTO course_categories (name, description, created_at) VALUES (@name, @desc, GETDATE())"
    );

    res.status(201).json({ message: "✅ Tạo danh mục thành công" });
  } catch (err) {
    res.status(500).json({ error: "❌ Lỗi tạo danh mục: " + err.message });
  }
};

module.exports = createCategory;
