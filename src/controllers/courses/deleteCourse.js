const { sql, poolPromise } = require("../../config/db.config");

const deleteCourse = async (req, res) => {
  const { course_id } = req.params;
  const { uid } = req.body;

  if (!uid || !course_id) {
    return res.status(400).json({ error: "Thiếu uid hoặc course_id" });
  }

  try {
    const pool = await poolPromise;
    const request = new sql.Request(pool);

    // Lấy vai trò người dùng
    request.input("uid", sql.NVarChar, uid);
    const userResult = await request.query(`
      SELECT role FROM users WHERE uid = @uid
    `);

    if (userResult.recordset.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy người dùng" });
    }

    const role = userResult.recordset[0].role;

    // Chỉ cho phép mentor hoặc admin
    if (role !== "admin" && role !== "mentor") {
      return res.status(403).json({ error: "Bạn không có quyền xóa khóa học" });
    }

    // Lấy instructor_uid của khóa học
    const courseCheckRequest = new sql.Request(pool);
    courseCheckRequest.input("course_id", sql.Int, course_id);
    const courseResult = await courseCheckRequest.query(`
      SELECT instructor_uid FROM courses WHERE course_id = @course_id
    `);

    if (courseResult.recordset.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy khóa học để xóa" });
    }

    const course = courseResult.recordset[0];

    // Nếu là mentor thì chỉ được xóa khóa học của mình
    if (role === "mentor" && course.instructor_uid !== uid) {
      return res
        .status(403)
        .json({ error: "Bạn chỉ được phép xóa khóa học do bạn tạo" });
    }

    // Xoá khóa học
    const deleteRequest = new sql.Request(pool);
    deleteRequest.input("course_id", sql.Int, course_id);
    await deleteRequest.query(`
      DELETE FROM courses WHERE course_id = @course_id
    `);

    res.status(200).json({ message: "Xóa khóa học thành công" });
  } catch (err) {
    res.status(500).json({ error: "Lỗi xóa khóa học: " + err.message });
  }
};

module.exports = deleteCourse;
