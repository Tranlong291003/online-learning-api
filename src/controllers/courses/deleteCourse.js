const { pool } = require("../../config/db.config");
const { deleteFiles } = require("../../services/fileStorage");
const { parsePositiveInt } = require("../../utils/parseId");
const { sendServerError } = require("../../utils/errorResponse");
const { resolveActorUid } = require("../../middleware/actor");

const deleteCourse = async (req, res) => {
  const course_id = parsePositiveInt(req.params.course_id);

  if (!course_id) {
    return res.status(400).json({ error: "course_id không hợp lệ" });
  }

  // Lấy uid từ token; chỉ admin mới được thao tác thay người khác
  const uid = resolveActorUid(req, res, req.body.uid);
  if (!uid) return;

  let client;

  try {
    client = await pool.connect();

    // Lấy vai trò người dùng
    const userResult = await client.query(
      "SELECT role FROM users WHERE uid = $1",
      [uid]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy người dùng" });
    }

    const role = userResult.rows[0].role;

    if (role !== "admin" && role !== "mentor") {
      return res.status(403).json({ error: "Bạn không có quyền xóa khóa học" });
    }

    // Lấy instructor_uid của khóa học
    const courseResult = await client.query(
      "SELECT instructor_uid FROM courses WHERE course_id = $1",
      [course_id]
    );

    if (courseResult.rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy khóa học để xóa" });
    }

    const course = courseResult.rows[0];

    if (role === "mentor" && course.instructor_uid !== uid) {
      return res
        .status(403)
        .json({ error: "Bạn chỉ được phép xóa khóa học do bạn tạo" });
    }

    // Bắt đầu transaction
    await client.query("BEGIN");

    try {
      // Xóa các bảng liên quan theo thứ tự
      // 1. Xóa quiz_results
      await client.query(
        `DELETE FROM quiz_results
         WHERE quiz_id IN (SELECT quiz_id FROM quizzes WHERE course_id = $1)`,
        [course_id]
      );

      // 2. Xóa quiz_questions
      await client.query(
        `DELETE FROM quiz_questions
         WHERE quiz_id IN (SELECT quiz_id FROM quizzes WHERE course_id = $1)`,
        [course_id]
      );

      // 3. Xóa quizzes
      await client.query(
        "DELETE FROM quizzes WHERE course_id = $1",
        [course_id]
      );

      // 4. Thu thập đường dẫn file để xoá sau khi commit: thumbnail của khoá và
      //    pdf/slide của mọi bài học trong khoá. Nếu không dọn, mỗi lần xoá khoá
      //    sẽ để lại file mồ côi trong uploaded_files.
      const fileRows = await client.query(
        `SELECT thumbnail_url AS url FROM courses WHERE course_id = $1
         UNION ALL
         SELECT pdf_url FROM lessons WHERE course_id = $1
         UNION ALL
         SELECT slide_url FROM lessons WHERE course_id = $1`,
        [course_id]
      );
      const filePaths = fileRows.rows.map((r) => r.url).filter(Boolean);

      // 5. Xóa lesson_progress
      await client.query(
        "DELETE FROM lesson_progress WHERE course_id = $1",
        [course_id]
      );

      // 6. Xóa lessons
      await client.query(
        "DELETE FROM lessons WHERE course_id = $1",
        [course_id]
      );

      // 7. Xóa bookmarks
      await client.query(
        "DELETE FROM bookmarks WHERE course_id = $1",
        [course_id]
      );

      // 8. Xóa course_reviews
      await client.query(
        "DELETE FROM course_reviews WHERE course_id = $1",
        [course_id]
      );

      // 9. Xóa enrollments
      await client.query(
        "DELETE FROM enrollments WHERE course_id = $1",
        [course_id]
      );

      // 10. Xóa course
      await client.query(
        "DELETE FROM courses WHERE course_id = $1",
        [course_id]
      );

      // Commit transaction
      await client.query("COMMIT");

      // Sau khi commit mới xoá file: nếu transaction rollback thì file vẫn cần
      // để bản ghi còn nguyên vẹn trỏ tới.
      await deleteFiles(filePaths);

      res.status(200).json({
        success: true,
        message: "Xóa khóa học và các dữ liệu liên quan thành công",
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  } catch (err) {
    // Dùng sendServerError: nối thẳng err.message vào response sẽ rò chi tiết
    // CSDL (tên bảng/cột/ràng buộc) ra client, kể cả ở production.
    sendServerError(res, "Lỗi xóa khóa học", err);
  } finally {
    if (client) client.release();
  }
};

module.exports = deleteCourse;
