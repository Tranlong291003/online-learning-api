// controllers/courseCategories/createCategory.js
const { sql, poolPromise } = require("../../config/db.config"); // Import sql và poolPromise từ db.config

const createCategory = async (req, res) => {
  try {
    const { name, description, uid } = req.body; // Lấy UID từ req.body

    if (!name)
      return res
        .status(400)
        .json({ error: "Tên danh mục không được bỏ trống" });

    if (!uid) return res.status(400).json({ error: "UID không được bỏ trống" });

    // Kết nối đến cơ sở dữ liệu bằng poolPromise
    const pool = await poolPromise; // Chờ kết nối sẵn sàng
    const request = new sql.Request(pool); // Tạo một request từ pool kết nối

    // Đặt tham số uid vào request để sử dụng trong query
    request.input("uid", sql.NVarChar, uid);

    // Kiểm tra vai trò của người dùng
    const roleQuery = await request.query(
      `SELECT role FROM users WHERE uid = @uid`
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
