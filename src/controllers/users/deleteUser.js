const { pool } = require("../../config/db.config");
const { deleteFiles } = require("../../services/fileStorage");
const { sendServerError } = require("../../utils/errorResponse");
const { isForeignKeyViolation } = require("../../utils/dbErrors");

/**
 * Nhận diện lỗi "còn dữ liệu liên quan" của cả hai môi trường.
 *
 * Xem src/utils/dbErrors.js — PostgreSQL trả "23503", D1/SQLite trả errcode 787.
 */

const deleteUser = async (req, res) => {
  const { id } = req.params;

  // Đã được chặn ở tầng route (authorize("admin")). Giữ lại làm lớp phủ
  // thứ hai phòng khi route được mount lại mà quên middleware.
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Bạn không có quyền xoá người dùng" });
  }

  // Xoá chính mình sẽ chấm dứt luôn phiên đang dùng để thực hiện thao tác này.
  if (String(id) === String(req.user.uid)) {
    return res.status(400).json({ error: "Không thể xoá tài khoản của chính mình" });
  }

  try {
    // Thu thập đường dẫn file TRƯỚC khi xoá người dùng: sau khi xoá thì
    // upgrade_requests không còn truy vấn được và ảnh sẽ thành mồ côi.
    const fileRows = await pool.query(
      `SELECT avatar_url AS url FROM users WHERE uid = $1
       UNION ALL
       SELECT image_url FROM upgrade_requests WHERE user_uid = $1`,
      [id]
    );
    const filePaths = fileRows.rows.map((r) => r.url).filter(Boolean);

    // Xoá dữ liệu con TRƯỚC khi xoá user.
    //
    // Schema D1 (cloudflare/d1-schema.sql) khai báo khoá ngoại nhưng KHÔNG có
    // ON DELETE CASCADE, nên trên production lệnh xoá user thất bại ngay khi
    // người đó còn một thông báo hoặc một phiên đăng nhập. PostgreSQL thì lại
    // có CASCADE cho các bảng này — đó là lý do lỗi chỉ lộ ra ở production.
    //
    // Các bảng dưới đây là dữ liệu CÁ NHÂN, xoá theo user là đúng nghiệp vụ.
    // Ngược lại, courses/quizzes/lessons trỏ tới user với NO ACTION nên vẫn
    // chặn được ở bước cuối — đó là hành vi mong muốn (báo 409 để admin xử lý
    // tài nguyên của mentor trước).
    await pool.batch([
      { text: "DELETE FROM notifications WHERE uid = $1", values: [id] },
      { text: "DELETE FROM refresh_tokens WHERE uid = $1", values: [id] },
      { text: "DELETE FROM password_resets WHERE uid = $1", values: [id] },
      { text: "DELETE FROM upgrade_requests WHERE user_uid = $1", values: [id] },
      { text: "DELETE FROM lesson_progress WHERE user_uid = $1", values: [id] },
      { text: "DELETE FROM bookmarks WHERE user_uid = $1", values: [id] },
      { text: "DELETE FROM course_reviews WHERE user_uid = $1", values: [id] },
      { text: "DELETE FROM enrollments WHERE user_uid = $1", values: [id] },
      { text: "DELETE FROM quiz_results WHERE user_uid = $1", values: [id] },
    ]);

    // Xoá user. Tài khoản đăng nhập giờ do chính API quản lý
    // (users.password_hash) nên xoá dòng này là chấm dứt mọi khả năng đăng nhập.
    const result = await pool.query(
      "DELETE FROM users WHERE uid = $1 RETURNING uid",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy người dùng" });
    }

    await deleteFiles(filePaths);

    return res.json({ message: "Đã xóa người dùng thành công" });
  } catch (err) {
    console.error("Error in deleteUser:", err);
    if (isForeignKeyViolation(err)) {
      return res
        .status(409)
        .json({ error: "Không thể xoá người dùng do còn dữ liệu liên quan" });
    }
    return sendServerError(res, "Lỗi khi xóa người dùng", err);
  }
};

module.exports = deleteUser;
