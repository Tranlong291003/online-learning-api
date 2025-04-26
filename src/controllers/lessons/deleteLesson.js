const { sql, poolPromise } = require("../../config/db.config");
const fs = require("fs");
const path = require("path");

const deleteLesson = async (req, res) => {
  const { lesson_id } = req.params;
  const { uid } = req.body;

  if (!uid) {
    return res.status(400).json({ error: "UID không hợp lệ" });
  }

  try {
    const pool = await poolPromise;
    const request = new sql.Request(pool);

    // Lấy role người dùng
    request.input("uid", sql.NVarChar, uid);
    const roleResult = await request.query(`
      SELECT role FROM users WHERE uid = @uid
    `);

    const userRole = roleResult.recordset[0]?.role;
    if (!userRole) {
      return res
        .status(403)
        .json({ error: "Không xác định được vai trò người dùng" });
    }

    // Lấy bài học và thông tin creator_uid
    request.input("lesson_id", sql.Int, lesson_id);
    const lessonResult = await request.query(`
      SELECT lesson_id, pdf_url, slide_url, creator_uid FROM lessons WHERE lesson_id = @lesson_id
    `);

    if (lessonResult.recordset.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy bài học để xoá" });
    }

    const lesson = lessonResult.recordset[0];

    // Nếu là mentor, chỉ được xoá bài học của mình
    if (userRole === "mentor" && lesson.creator_uid !== uid) {
      return res
        .status(403)
        .json({ error: "Bạn chỉ được xoá bài học do bạn tạo" });
    }

    // Xoá file nếu có
    const deleteFile = (urlPath) => {
      if (!urlPath) return;
      const absolutePath = path.join(__dirname, "../../public", urlPath);
      if (fs.existsSync(absolutePath)) fs.unlinkSync(absolutePath);
    };

    deleteFile(lesson.pdf_url);
    deleteFile(lesson.slide_url);

    // Xoá bản ghi trong database
    const deleteRequest = new sql.Request(pool);
    deleteRequest.input("lesson_id", sql.Int, lesson_id);
    await deleteRequest.query(`
      DELETE FROM lessons WHERE lesson_id = @lesson_id
    `);

    res.status(200).json({ message: "Xoá bài học thành công" });
  } catch (err) {
    res.status(500).json({ error: "Lỗi xoá bài học: " + err.message });
  }
};

module.exports = deleteLesson;
