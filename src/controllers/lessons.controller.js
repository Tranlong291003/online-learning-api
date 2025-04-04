// 📄 src/controllers/lessons.controller.js
const { sql, poolConnect, pool } = require("../config/db.config");

exports.getAllLessons = async (req, res) => {
  const { id } = req.params; // Course ID
  try {
    await poolConnect;
    const request = new sql.Request(pool);
    request.input("courseId", sql.Int, id);
    const result = await request.query(
      "SELECT * FROM lessons WHERE course_id = @courseId"
    );

    if (result.recordset.length === 0) {
      return res
        .status(404)
        .json({ error: "Không tìm thấy bài học cho khóa học này" });
    }

    res.status(200).json({
      message: "Lấy danh sách bài học thành công",
      data: result.recordset,
    });
  } catch (err) {
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

exports.createLesson = async (req, res) => {
  const { course_id, title, content, duration } = req.body;

  if (!course_id || !title || !content) {
    return res
      .status(400)
      .json({ error: "Các trường course_id, title, content là bắt buộc" });
  }

  try {
    await poolConnect;
    const request = new sql.Request(pool);
    request.input("course_id", sql.Int, course_id);
    request.input("title", sql.NVarChar, title);
    request.input("content", sql.NVarChar, content);
    request.input("duration", sql.Int, duration || 0); // Nếu không có duration, sẽ gán giá trị mặc định 0

    await request.query(`
      INSERT INTO lessons (course_id, title, content, duration, created_at, updated_at)
      VALUES (@course_id, @title, @content, @duration, GETDATE(), GETDATE())
    `);

    res.status(201).json({ message: "Tạo bài học mới thành công" });
  } catch (err) {
    res.status(500).json({ error: "Lỗi tạo bài học: " + err.message });
  }
};

exports.updateLesson = async (req, res) => {
  const { id } = req.params; // Lesson ID
  const { title, content, duration } = req.body;

  try {
    await poolConnect;
    const request = new sql.Request(pool);
    request.input("id", sql.Int, id);
    request.input("title", sql.NVarChar, title);
    request.input("content", sql.NVarChar, content);
    request.input("duration", sql.Int, duration);

    const result = await request.query(`
      UPDATE lessons
      SET title = @title, content = @content, duration = @duration, updated_at = GETDATE()
      WHERE id = @id
    `);

    if (result.rowsAffected[0] === 0) {
      return res
        .status(404)
        .json({ error: "Không tìm thấy bài học để cập nhật" });
    }

    res.status(200).json({ message: "Cập nhật bài học thành công" });
  } catch (err) {
    res.status(500).json({ error: "Lỗi cập nhật bài học: " + err.message });
  }
};

exports.deleteLesson = async (req, res) => {
  const { id } = req.params; // Lesson ID

  try {
    await poolConnect;
    const request = new sql.Request(pool);
    request.input("id", sql.Int, id);

    const result = await request.query("DELETE FROM lessons WHERE id = @id");

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: "Không tìm thấy bài học để xoá" });
    }

    res.status(200).json({ message: "Xoá bài học thành công" });
  } catch (err) {
    res.status(500).json({ error: "Lỗi xoá bài học: " + err.message });
  }
};
