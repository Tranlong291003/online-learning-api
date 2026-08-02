const { pool } = require("../../config/db.config");
const fs = require("fs");
const path = require("path");

const deleteLesson = async (req, res) => {
  const { lesson_id } = req.params;
  const { uid } = req.body;

  if (!uid) {
    return res.status(400).json({ error: "UID không hợp lệ" });
  }

  try {
    // Lấy role
    const roleResult = await pool.query(
      "SELECT role FROM users WHERE uid = $1",
      [uid]
    );
    const userRole = roleResult.rows[0]?.role;

    if (!userRole) {
      return res.status(403).json({ error: "Không xác định được vai trò người dùng" });
    }

    // Lấy bài học
    const lessonResult = await pool.query(
      "SELECT lesson_id, pdf_url, slide_url, creator_uid FROM lessons WHERE lesson_id = $1",
      [lesson_id]
    );

    if (lessonResult.rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy bài học để xoá" });
    }

    const lesson = lessonResult.rows[0];

    if (
      userRole !== "admin" &&
      !(userRole === "mentor" && lesson.creator_uid === uid)
    ) {
      return res.status(403).json({ error: "Bạn chỉ được xoá bài học do bạn tạo" });
    }

    // Xoá file
    const deleteFile = (urlPath) => {
      if (!urlPath) return;
      const absolutePath = path.join(__dirname, "../../public", urlPath);
      if (fs.existsSync(absolutePath)) fs.unlinkSync(absolutePath);
    };

    deleteFile(lesson.pdf_url);
    deleteFile(lesson.slide_url);

    // Xoá tiến độ liên quan trước để không vướng foreign key.
    await pool.query("DELETE FROM lesson_progress WHERE lesson_id = $1", [lesson_id]);

    // Xoá trong DB
    await pool.query("DELETE FROM lessons WHERE lesson_id = $1", [lesson_id]);

    res.status(200).json({ message: "Xoá bài học thành công" });
  } catch (err) {
    res.status(500).json({ error: "Lỗi xoá bài học: " + err.message });
  }
};

module.exports = deleteLesson;
