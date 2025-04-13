const { sql, poolConnect, pool } = require("../../config/db.config");

const deleteLesson = async (req, res) => {
  const { lesson_id } = req.params;

  try {
    await poolConnect;
    const request = new sql.Request(pool);
    request.input("lesson_id", sql.Int, lesson_id);

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
