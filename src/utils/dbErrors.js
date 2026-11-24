/**
 * Nhận diện lỗi CSDL cần dịch sang mã HTTP cụ thể.
 *
 * Cùng một lỗi nghiệp vụ có mã khác nhau ở hai môi trường:
 *   - PostgreSQL: `code` là mã SQLSTATE ("23503", "23505"...).
 *   - D1/SQLite: `code` luôn là "ERR_SQLITE_ERROR", mã thật nằm ở `errcode`
 *     (787 = SQLITE_CONSTRAINT_FOREIGNKEY, 2067 = SQLITE_CONSTRAINT_UNIQUE).
 *
 * Trước đây các controller chỉ so `err.code === "23503"`, nên nhánh trả 409
 * không bao giờ chạy trên production (D1) và client nhận 500 chung chung.
 */

/** Vi phạm khoá ngoại — "còn dữ liệu liên quan". */
function isForeignKeyViolation(err) {
  return err?.code === "23503" || err?.errcode === 787;
}

/** Vi phạm ràng buộc duy nhất — "đã tồn tại". */
function isUniqueViolation(err) {
  const message = String(err?.message || "");
  return (
    err?.code === "23505" ||
    err?.errcode === 2067 ||
    err?.errcode === 1555 ||
    /UNIQUE constraint failed/i.test(message)
  );
}

module.exports = { isForeignKeyViolation, isUniqueViolation };
