const { sql, poolPromise } = require("../../config/db.config");

const changeCourseStatus = async (req, res) => {
  const { course_id } = req.params;
  const { status, uid } = req.body;

  if (!status || !uid) {
    return res.status(400).json({ error: "Thiếu trạng thái hoặc UID" });
  }

  try {
    const pool = await poolPromise;
    const request = new sql.Request(pool);

    // Kiểm tra vai trò người dùng
    request.input("uid", sql.NVarChar, uid);
    const roleResult = await request.query(`
      SELECT role FROM users WHERE uid = @uid
    `);

    const userRole = roleResult.recordset[0]?.role;

    if (userRole !== "admin") {
      return res
        .status(403)
        .json({ error: "Chỉ admin mới có quyền duyệt hoặc từ chối khóa học" });
    }

    const normalizedStatus = status.trim().toLowerCase();
    const isApproved = normalizedStatus === "da_duyet";

    // Thực hiện cập nhật
    const updateRequest = new sql.Request(pool);
    updateRequest.input("course_id", sql.Int, course_id);
    updateRequest.input("status", sql.NVarChar, status);
    updateRequest.input("approved_at", isApproved ? new Date() : null);

    const result = await updateRequest.query(`
      UPDATE courses
      SET
        status = @status,
        approved_at = @approved_at,
        updated_at = GETDATE()
      WHERE course_id = @course_id
    `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({
        error: "Không tìm thấy khóa học để cập nhật trạng thái",
      });
    }

    // Truy vấn lại khóa học
    const updatedCourse = await updateRequest.query(`
      SELECT * FROM courses WHERE course_id = @course_id
    `);

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
