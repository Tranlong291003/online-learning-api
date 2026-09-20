/**
 * Truy vấn người dùng phục vụ xác thực.
 *
 * Tách riêng khỏi middleware/controller để:
 *  - middleware không phụ thuộc trực tiếp vào db.config (dễ mock trong test), và
 *  - có một chỗ duy nhất để thêm cache nếu sau này cần giảm tải DB.
 *
 * Lưu ý bảo mật: KHÔNG bao giờ trả `password_hash` ra ngoài response. Hàm
 * `findUserForLogin` trả hash vì hàm đó chỉ được dùng nội bộ trong luồng đăng nhập.
 */
const { pool } = require("../config/db.config");

/** Các cột an toàn để trả cho client. */
const PUBLIC_USER_COLUMNS = `
  uid, email, name, avatar_url, bio, phone, gender, birthdate,
  role, is_active, created_at, updated_at
`;

/**
 * Trạng thái tối thiểu cho middleware xác thực.
 * Trả về { role, is_active } hoặc null nếu uid không tồn tại trong DB.
 */
async function getAuthStateForUid(uid) {
  if (!uid) return null;
  const result = await pool.query(
    "SELECT role, is_active FROM users WHERE uid = $1",
    [uid]
  );
  if (result.rows.length === 0) return null;
  return { role: result.rows[0].role, is_active: result.rows[0].is_active };
}

/** Hồ sơ đầy đủ (không gồm mật khẩu) của một người dùng. */
async function getPublicProfile(uid) {
  if (!uid) return null;
  const result = await pool.query(
    `SELECT ${PUBLIC_USER_COLUMNS} FROM users WHERE uid = $1`,
    [uid]
  );
  return result.rows[0] || null;
}

/**
 * Tra người dùng theo email để đăng nhập — CHỈ dùng nội bộ.
 *
 * Trả kèm `password_hash`, `failed_login_attempts` và `locked_until` vì luồng
 * đăng nhập cần chúng; không dùng hàm này để trả dữ liệu ra client.
 */
async function findUserForLogin(email) {
  if (!email) return null;
  const result = await pool.query(
    `SELECT uid, email, name, role, is_active, password_hash,
            failed_login_attempts, locked_until, fcm_token
     FROM users
     WHERE LOWER(email) = LOWER($1)`,
    [email.trim()]
  );
  return result.rows[0] || null;
}

/** Đặt lại bộ đếm đăng nhập sai và cập nhật FCM token (nếu có). */
async function registerSuccessfulLogin(uid, fcmToken) {
  if (fcmToken) {
    await pool.query(
      `UPDATE users
       SET failed_login_attempts = 0, locked_until = NULL, fcm_token = $2, updated_at = NOW()
       WHERE uid = $1`,
      [uid, fcmToken]
    );
  } else {
    await pool.query(
      `UPDATE users
       SET failed_login_attempts = 0, locked_until = NULL
       WHERE uid = $1`,
      [uid]
    );
  }
}

/**
 * Ghi nhận một lần đăng nhập sai.
 *
 * Khi số lần sai đạt `maxAttempts`, tài khoản bị tạm khoá trong `lockMinutes`.
 * Bộ đếm cũng được đặt lại khi khoá, để sau khi hết hạn khoá người dùng có lại
 * đủ số lần thử (nếu không, mọi lần sai tiếp theo sẽ khoá ngay lập tức).
 *
 * @returns {Promise<Date|null>} thời điểm hết khoá, hoặc null nếu chưa bị khoá.
 */
async function registerFailedLogin(uid, { maxAttempts, lockMinutes }) {
  // make_interval(mins => ...) nhận tham số số trực tiếp, tránh phải nội suy
  // chuỗi vào INTERVAL.
  const result = await pool.query(
    `UPDATE users
     SET failed_login_attempts = failed_login_attempts + 1,
         locked_until = CASE
           WHEN failed_login_attempts + 1 >= $2 THEN NOW() + make_interval(mins => $3)
           ELSE locked_until
         END
     WHERE uid = $1
     RETURNING failed_login_attempts, locked_until`,
    [uid, maxAttempts, Number(lockMinutes)]
  );

  const row = result.rows[0];
  if (!row) return null;

  if (row.failed_login_attempts >= maxAttempts && row.locked_until) {
    // Đã tới ngưỡng khoá -> đặt lại bộ đếm để chu kỳ sau bắt đầu từ đầu.
    await pool.query(
      "UPDATE users SET failed_login_attempts = 0 WHERE uid = $1",
      [uid]
    );
    return row.locked_until;
  }

  return null;
}

/** Đặt mật khẩu mới và xoá trạng thái khoá. */
async function setPasswordHash(uid, passwordHash) {
  await pool.query(
    `UPDATE users
     SET password_hash = $2,
         failed_login_attempts = 0,
         locked_until = NULL,
         updated_at = NOW()
     WHERE uid = $1`,
    [uid, passwordHash]
  );
}

module.exports = {
  PUBLIC_USER_COLUMNS,
  getAuthStateForUid,
  getPublicProfile,
  findUserForLogin,
  registerSuccessfulLogin,
  registerFailedLogin,
  setPasswordHash,
};
