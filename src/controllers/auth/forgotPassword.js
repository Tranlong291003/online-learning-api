const crypto = require("node:crypto");
const { pool } = require("../../config/db.config");
const { hashPassword, validatePassword } = require("../../services/passwordService");
const { hashToken } = require("../../services/tokenService");
const { findUserForLogin, setPasswordHash } = require("../../services/authUserLookup");
const { revokeAllForUser } = require("../../services/tokenService");

/** Token đặt lại mật khẩu sống 15 phút — đủ để mở email, không đủ lâu để bị lạm dụng. */
const RESET_TOKEN_TTL_MINUTES = Number(process.env.RESET_TOKEN_TTL_MINUTES || 15);
const RESET_TOKEN_BYTES = 32;

/**
 * Bước 1 — yêu cầu đặt lại mật khẩu.
 *
 * LUÔN trả cùng một thông điệp dù email có tồn tại hay không. Nếu trả 404 khi
 * không tìm thấy email, endpoint này trở thành công cụ dò xem email nào đã đăng
 * ký trong hệ thống.
 *
 * TODO: cần tích hợp dịch vụ gửi mail (Resend/SendGrid/SES). Hiện tại token
 * được trả về trong response ở môi trường KHÔNG phải production để dev tự test
 * luồng; ở production token chỉ nằm trong DB và phải gửi qua email.
 */
const forgotPassword = async (req, res) => {
  const { email } = req.body;

  const genericResponse = {
    success: true,
    message: "Nếu email tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi",
  };

  if (!email) {
    return res.status(400).json({ error: "Thiếu email" });
  }

  try {
    const user = await findUserForLogin(email);

    if (!user || user.is_active === false) {
      return res.json(genericResponse);
    }

    // Vô hiệu hoá các yêu cầu cũ còn treo, tránh việc nhiều token cùng hiệu lực.
    await pool.query(
      `UPDATE password_resets SET used_at = NOW()
       WHERE uid = $1 AND used_at IS NULL`,
      [user.uid]
    );

    const rawToken = crypto.randomBytes(RESET_TOKEN_BYTES).toString("base64url");
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);

    await pool.query(
      `INSERT INTO password_resets (uid, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [user.uid, hashToken(rawToken), expiresAt]
    );

    if (process.env.NODE_ENV !== "production") {
      return res.json({ ...genericResponse, reset_token: rawToken });
    }

    return res.json(genericResponse);
  } catch (error) {
    console.error("Lỗi khi yêu cầu đặt lại mật khẩu:", error);
    return res.status(500).json({ error: "Lỗi khi yêu cầu đặt lại mật khẩu" });
  }
};

/**
 * Bước 2 — đặt lại mật khẩu bằng token.
 *
 * Token chỉ dùng được một lần: sau khi đổi mật khẩu thành công, `used_at` được
 * ghi lại nên không thể phát lại request cũ.
 */
const resetPassword = async (req, res) => {
  const { token, new_password: newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ error: "Thiếu token hoặc mật khẩu mới" });
  }

  const passwordCheck = validatePassword(newPassword);
  if (!passwordCheck.valid) {
    return res.status(400).json({ error: passwordCheck.error });
  }

  try {
    const result = await pool.query(
      `SELECT reset_id, uid, expires_at, used_at
       FROM password_resets
       WHERE token_hash = $1`,
      [hashToken(token)]
    );

    const record = result.rows[0];

    if (!record || record.used_at || new Date(record.expires_at) <= new Date()) {
      return res
        .status(400)
        .json({ error: "Token đặt lại mật khẩu không hợp lệ hoặc đã hết hạn" });
    }

    const newHash = await hashPassword(newPassword);
    await setPasswordHash(record.uid, newHash);

    await pool.query(
      "UPDATE password_resets SET used_at = NOW() WHERE reset_id = $1",
      [record.reset_id]
    );

    // Đặt lại mật khẩu là tình huống nghi ngờ bị chiếm tài khoản -> đá hết phiên cũ.
    await revokeAllForUser(record.uid);

    return res.json({
      success: true,
      message: "Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.",
    });
  } catch (error) {
    console.error("Lỗi khi đặt lại mật khẩu:", error);
    return res.status(500).json({ error: "Lỗi khi đặt lại mật khẩu" });
  }
};

module.exports = { forgotPassword, resetPassword };
