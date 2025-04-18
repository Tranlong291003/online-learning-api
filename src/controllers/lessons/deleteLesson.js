const { sql, poolPromise } = require("../../config/db.config");

const deleteLesson = async (req, res) => {
  const { lesson_id } = req.params;
  const { uid } = req.body; // Thêm UID để kiểm tra quyền người dùng

  if (!uid) {
    return res.status(400).json({ error: "UID không hợp lệ" });
  }

  try {
    const pool = await poolPromise; // Sử dụng poolPromise để kết nối
    const request = new sql.Request(pool);

    // Kiểm tra quyền của người dùng
    request.input("uid", sql.NVarChar, uid);
    const roleQuery = await request.query(
      `SELECT role FROM users WHERE uid = @uid`
    );

    const userRole = roleQuery.recordset[0]?.role;

    // Kiểm tra quyền xóa bài học (Admin hoặc Giảng viên)
    if (userRole !== "admin" && userRole !== "giang_vien") {
      return res.status(403).json({
        error: "Bạn không có quyền xóa bài học",
      });
    }

    // Kiểm tra sự tồn tại của bài học
    request.input("lesson_id", sql.Int, lesson_id);
    const lessonQuery = await request.query(`
      SELECT * FROM lessons WHERE lesson_id = @lesson_id
    `);

    if (lessonQuery.recordset.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy bài học để xoá" });
    }

    // Thực hiện xóa bài học
    const result = await request.query(`
      DELETE FROM lessons WHERE lesson_id = @lesson_id
    `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: "Không tìm thấy bài học để xoá" });
    }

    res.status(200).json({ message: "Xoá bài học thành công" });
  } catch (err) {
    res.status(500).json({ error: "Lỗi xoá bài học: " + err.message });
  }
};

module.exports = deleteLesson;
