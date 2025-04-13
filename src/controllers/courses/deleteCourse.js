const { sql, poolConnect, pool } = require("../../config/db.config");

const deleteCourse = async (req, res) => {
  const { course_id } = req.params;

  try {
    await poolConnect;
    const request = new sql.Request(pool);
    request.input("course_id", sql.Int, course_id);
    const result = await request.query(
      "DELETE FROM courses WHERE course_id = @course_id"
    );

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: "Không tìm thấy khóa học để xoá" });
    }

    res.status(200).json({ message: "Xoá khóa học thành công" });
  } catch (err) {
    res.status(500).json({ error: "Lỗi xoá khóa học: " + err.message });
  }
};
module.exports = deleteCourse;
