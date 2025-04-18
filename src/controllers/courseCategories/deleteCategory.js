// controllers/courseCategories/deleteCategory.js
const { sql, poolPromise } = require("../../config/db.config");

const deleteCategory = async (req, res) => {
  try {
    const { category_id } = req.params; // Lấy category_id từ params
    const { uid } = req.body; // Lấy uid từ body

    if (!uid) return res.status(400).json({ error: "UID không được bỏ trống" });

    // Kết nối đến cơ sở dữ liệu bằng poolPromise
    const pool = await poolPromise; // Đảm bảo rằng kết nối đã sẵn sàng
    const request = new sql.Request(pool); // Tạo một request từ pool kết nối

    // Truy vấn vai trò của người dùng từ bảng users
    request.input("uid", sql.NVarChar, uid);
    const roleQuery = await request.query(
      `SELECT role FROM users WHERE uid = @uid` // Truy vấn lấy role của người dùng từ bảng users
    );

    // Kiểm tra xem người dùng có tồn tại không và lấy role
    if (roleQuery.recordset.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy người dùng" });
    }

    const userRole = roleQuery.recordset[0]?.role; // Lấy vai trò người dùng từ kết quả truy vấn

    // Kiểm tra vai trò của người dùng
    if (userRole !== "admin" && userRole !== "giang_vien") {
      return res.status(403).json({ error: "Bạn không có quyền xóa danh mục" });
    }

    // Nếu vai trò hợp lệ, tiếp tục xóa danh mục
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
