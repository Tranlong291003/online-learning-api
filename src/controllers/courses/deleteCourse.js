const { pool } = require("../../config/db.config");
const { deleteFiles } = require("../../services/fileStorage");
const { parsePositiveInt } = require("../../utils/parseId");
const { sendServerError } = require("../../utils/errorResponse");
const { resolveActorUid } = require("../../middleware/actor");

/**
 * Xoá khoá học cùng toàn bộ dữ liệu con.
 *
 * Luôn dùng `pool.batch`. Trước đây file này có hai nhánh: nhánh `batch` cho D1
 * và nhánh `connect()` + BEGIN/COMMIT cho PostgreSQL. Nhưng `pool` trong
 * src/config/db.config.js LUÔN có hàm `batch` (nó tự mở transaction khi chạy
 * PostgreSQL), nên nhánh thứ hai không bao giờ chạy — chỉ có test mock là đi
 * vào đó, khiến độ phủ thật của endpoint này bằng 0.
 *
 * Thứ tự xoá phải theo phụ thuộc khoá ngoại: D1/SQLite không có ON DELETE
 * CASCADE trên các bảng này nên xoá sai thứ tự sẽ bị chặn.
 */
const deleteCourse = async (req, res) => {
  const course_id = parsePositiveInt(req.params.course_id);

  if (!course_id) {
    return res.status(400).json({ error: "course_id không hợp lệ" });
  }

  // Lấy uid từ token; chỉ admin mới được thao tác thay người khác
  const uid = resolveActorUid(req, res, req.body.uid);
  if (!uid) return;

  try {
    const userResult = await pool.query("SELECT role FROM users WHERE uid = $1", [uid]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy người dùng" });
    }
    const role = userResult.rows[0].role;
    if (role !== "admin" && role !== "mentor") {
      return res.status(403).json({ error: "Bạn không có quyền xóa khóa học" });
    }

    const courseResult = await pool.query(
      "SELECT instructor_uid FROM courses WHERE course_id = $1",
      [course_id]
    );
    if (courseResult.rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy khóa học để xóa" });
    }
    if (role === "mentor" && courseResult.rows[0].instructor_uid !== uid) {
      return res.status(403).json({ error: "Bạn chỉ được phép xóa khóa học do bạn tạo" });
    }

    // Thu thập đường dẫn file TRƯỚC khi xoá: sau khi xoá thì không còn truy vấn
    // được nữa và file sẽ thành mồ côi trong uploaded_files.
    const fileRows = await pool.query(
      `SELECT thumbnail_url AS url FROM courses WHERE course_id = $1
       UNION ALL
       SELECT pdf_url FROM lessons WHERE course_id = $1
       UNION ALL
       SELECT slide_url FROM lessons WHERE course_id = $1`,
      [course_id]
    );
    const filePaths = fileRows.rows.map((row) => row.url).filter(Boolean);

    await pool.batch([
      { text: "DELETE FROM quiz_results WHERE quiz_id IN (SELECT quiz_id FROM quizzes WHERE course_id = $1)", values: [course_id] },
      { text: "DELETE FROM quiz_questions WHERE quiz_id IN (SELECT quiz_id FROM quizzes WHERE course_id = $1)", values: [course_id] },
      { text: "DELETE FROM quizzes WHERE course_id = $1", values: [course_id] },
      { text: "DELETE FROM lesson_progress WHERE course_id = $1", values: [course_id] },
      { text: "DELETE FROM lessons WHERE course_id = $1", values: [course_id] },
      { text: "DELETE FROM bookmarks WHERE course_id = $1", values: [course_id] },
      { text: "DELETE FROM course_reviews WHERE course_id = $1", values: [course_id] },
      { text: "DELETE FROM enrollments WHERE course_id = $1", values: [course_id] },
      { text: "DELETE FROM courses WHERE course_id = $1", values: [course_id] },
    ]);

    // Sau khi commit mới xoá file: nếu transaction rollback thì bản ghi vẫn cần
    // file để trỏ tới.
    await deleteFiles(filePaths);

    return res.status(200).json({
      success: true,
      message: "Xóa khóa học và các dữ liệu liên quan thành công",
    });
  } catch (err) {
    // Dùng sendServerError: nối thẳng err.message vào response sẽ rò chi tiết
    // CSDL (tên bảng/cột/ràng buộc) ra client, kể cả ở production.
    return sendServerError(res, "Lỗi xóa khóa học", err);
  }
};

module.exports = deleteCourse;
