const { sql, poolConnect, pool } = require("../../config/db.config");

const changeCourseStatus = async (req, res) => {
  const { course_id } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ error: "Trạng thái khóa học là bắt buộc" });
  }

  try {
    await poolConnect;
    const request = new sql.Request(pool);

    request.input("course_id", sql.Int, course_id);
    request.input("status", sql.NVarChar, status);

    const isApproved = status.trim().toLowerCase() === "da_duyet";

    const result = await request.query(`
      UPDATE courses
      SET
        status = @status,
        approved_at = ${isApproved ? "GETDATE()" : "approved_at"},
        updated_at = GETDATE()
      WHERE course_id = @course_id
    `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({
        error: "Không tìm thấy khóa học để cập nhật trạng thái",
      });
    }

    const updatedCourse = await request.query(`
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
