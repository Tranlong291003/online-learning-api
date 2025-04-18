// controllers/courseCategories/deleteCourse.js
const { sql, poolPromise } = require("../../config/db.config");

const deleteCourse = async (req, res) => {
  const { course_id } = req.params;
  const { uid } = req.body; // Lấy UID từ body để kiểm tra quyền người dùng

  try {
    const pool = await poolPromise; // Sử dụng poolPromise để đảm bảo kết nối sẵn sàng
    const request = new sql.Request(pool);

    // Truy vấn để lấy vai trò của người dùng
    request.input("uid", sql.NVarChar, uid);
    const roleQuery = await request.query(
      `SELECT role FROM users WHERE uid = @uid`
    );

    const userRole = roleQuery.recordset[0]?.role;

    // Kiểm tra quyền của người dùng (chỉ cho phép admin và giang_vien xóa khóa học)
    if (userRole !== "admin" && userRole !== "giang_vien") {
      return res.status(403).json({ error: "Bạn không có quyền xóa khóa học" });
    }

    // Thực hiện xóa khóa học
    request.input("course_id", sql.Int, course_id);
    const result = await request.query(
      "DELETE FROM courses WHERE course_id = @course_id"
    );

    // Kiểm tra xem có khóa học nào bị xóa không
    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: "Không tìm thấy khóa học để xóa" });
    }

    // Trả về thông báo thành công
    res.status(200).json({ message: "Xóa khóa học thành công" });
  } catch (err) {
    // Xử lý lỗi server
    res.status(500).json({ error: "Lỗi xóa khóa học: " + err.message });
  }
};

module.exports = deleteCourse;
