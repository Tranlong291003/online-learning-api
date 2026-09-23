const { pool } = require("../../config/db.config");
const { parsePositiveInt } = require("../../utils/parseId");
const { sendServerError } = require("../../utils/errorResponse");
const { resolveActorUid } = require("../../middleware/actor");

const deleteLesson = async (req, res) => {
  const lesson_id = parsePositiveInt(req.params.lesson_id);

  if (!lesson_id) {
    return res.status(400).json({ error: "lesson_id không hợp lệ" });
  }

  // Lấy uid từ token; chỉ admin mới được thao tác thay người khác
  const uid = resolveActorUid(req, res, req.body.uid);
  if (!uid) return;

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

    // Xoá file đã upload khỏi CSDL.
    //
    // Trước đây xoá file trên đĩa. Giờ file nằm trong bảng uploaded_files, và
    // thao tác xoá phải chịu được việc bản ghi không tồn tại (dữ liệu cũ trỏ
    // tới file đóng gói kèm mã nguồn) — nếu không, xoá bài học sẽ lỗi 500.
    const deleteFile = async (urlPath) => {
      if (!urlPath) return;
      try {
        await pool.query("DELETE FROM uploaded_files WHERE public_path = $1", [urlPath]);
      } catch (err) {
        console.warn("Không xoá được file upload:", urlPath, err.message);
      }
    };

    await deleteFile(lesson.pdf_url);
    await deleteFile(lesson.slide_url);

    // Xoá tiến độ liên quan trước để không vướng foreign key.
    await pool.query("DELETE FROM lesson_progress WHERE lesson_id = $1", [lesson_id]);

    // Xoá trong DB
    await pool.query("DELETE FROM lessons WHERE lesson_id = $1", [lesson_id]);

    res.status(200).json({ message: "Xoá bài học thành công" });
  } catch (err) {
    sendServerError(res, "Lỗi xoá bài học", err);
  }
};

module.exports = deleteLesson;
