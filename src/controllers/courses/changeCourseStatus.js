// controllers/courseCategories/changeCourseStatus.js
const { sql, poolPromise } = require("../../config/db.config");

const changeCourseStatus = async (req, res) => {
  const { course_id } = req.params;
  const { status, uid } = req.body; // Thêm UID để kiểm tra quyền người dùng

  if (!status) {
    return res.status(400).json({ error: "Trạng thái khóa học là bắt buộc" });
  }

  try {
    const pool = await poolPromise; // Sử dụng poolPromise để đảm bảo kết nối
    const request = new sql.Request(pool);

    // Truy vấn để lấy vai trò của người dùng
    request.input("uid", sql.NVarChar, uid);
    const roleQuery = await request.query(
      `SELECT role FROM users WHERE uid = @uid`
    );

    const userRole = roleQuery.recordset[0]?.role;

    // Kiểm tra quyền của người dùng (chỉ cho phép admin duyệt khóa học)
    if (userRole !== "admin") {
      return res
        .status(403)
        .json({ error: "Chỉ admin mới có quyền duyệt khóa học" });
    }

    request.input("course_id", sql.Int, course_id);
    request.input("status", sql.NVarChar, status);

    // Kiểm tra xem trạng thái có phải là "da_duyet" không
    const isApproved = status.trim().toLowerCase() === "da_duyet";

    // Cập nhật trạng thái khóa học
    const result = await request.query(`
      UPDATE courses
      SET
        status = @status,
        approved_at = ${isApproved ? "GETDATE()" : "approved_at"},
        updated_at = GETDATE()
      WHERE course_id = @course_id
    `);

    // Kiểm tra xem có bản ghi nào bị ảnh hưởng không
    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({
        error: "Không tìm thấy khóa học để cập nhật trạng thái",
      });
    }

    // Lấy thông tin khóa học đã cập nhật
    const updatedCourse = await request.query(`
      SELECT * FROM courses WHERE course_id = @course_id
    `);

    // Trả về thông tin khóa học sau khi cập nhật trạng thái
    res.status(200).json({
      message: "Cập nhật trạng thái khóa học thành công",
      data: updatedCourse.recordset[0],
    });
  } catch (err) {
    res.status(500).json({
      error: "Lỗi cập nhật trạng thái khóa học: " + err.message,
    });
  }
};

module.exports = changeCourseStatus;
