/**
 * Hash và kiểm tra mật khẩu bằng bcrypt.
 *
 * Dùng bcryptjs (thuần JavaScript) thay vì `bcrypt`: bản native cần biên dịch
 * khi cài, dễ hỏng trên môi trường serverless/build sạch của Vercel và Render.
 */
const bcrypt = require("bcryptjs");
const {
  BCRYPT_ROUNDS,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
} = require("../config/auth.config");

/**
 * Kiểm tra mật khẩu có hợp lệ về mặt hình thức không.
 * @returns {{valid: true} | {valid: false, error: string}}
 */
function validatePassword(password) {
  if (typeof password !== "string" || password.length === 0) {
    return { valid: false, error: "Thiếu mật khẩu" };
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return {
      valid: false,
      error: `Mật khẩu phải có ít nhất ${PASSWORD_MIN_LENGTH} ký tự`,
    };
  }
  if (Buffer.byteLength(password, "utf8") > PASSWORD_MAX_LENGTH) {
    return {
      valid: false,
      error: `Mật khẩu không được vượt quá ${PASSWORD_MAX_LENGTH} byte`,
    };
  }
  return { valid: true };
}

async function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * So sánh mật khẩu với hash.
 *
 * Trả false (không ném lỗi) khi hash rỗng/không hợp lệ: tài khoản cũ di trú từ
 * Firebase có password_hash NULL, và người dùng đó phải nhận "sai thông tin
 * đăng nhập" chứ không phải lỗi 500.
 */
async function verifyPassword(password, hash) {
  if (typeof hash !== "string" || hash.length === 0) return false;
  try {
    return await bcrypt.compare(password, hash);
  } catch (error) {
    console.warn("Không so sánh được mật khẩu:", error.message);
    return false;
  }
}

module.exports = { validatePassword, hashPassword, verifyPassword };
