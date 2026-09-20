const crypto = require("node:crypto");
const { pool } = require("../../config/db.config");
const { hashPassword, validatePassword } = require("../../services/passwordService");
const { issueRefreshToken, signAccessToken } = require("../../services/tokenService");
const { PUBLIC_USER_COLUMNS } = require("../../services/authUserLookup");

// Regex cố tình dễ dãi: chặn rõ ràng các giá trị rác ("abc", "a@b") nhưng không
// cố mô phỏng đầy đủ RFC 5322 — làm vậy chỉ chặn nhầm email hợp lệ.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const NAME_MAX_LENGTH = 50;
const EMAIL_MAX_LENGTH = 100;

const register = async (req, res) => {
  const { email, password, name, avatar_url, bio, phone, fcmToken } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: "Thiếu thông tin người dùng" });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const normalizedName = String(name).trim();

  if (!EMAIL_PATTERN.test(normalizedEmail) || normalizedEmail.length > EMAIL_MAX_LENGTH) {
    return res.status(400).json({ error: "Email không hợp lệ" });
  }
  if (normalizedName.length === 0 || normalizedName.length > NAME_MAX_LENGTH) {
    return res
      .status(400)
      .json({ error: `Tên phải có từ 1 đến ${NAME_MAX_LENGTH} ký tự` });
  }

  const passwordCheck = validatePassword(password);
  if (!passwordCheck.valid) {
    return res.status(400).json({ error: passwordCheck.error });
  }

  try {
    const existing = await pool.query(
      "SELECT uid FROM users WHERE LOWER(email) = LOWER($1)",
      [normalizedEmail]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: "Email này đã được đăng ký" });
    }

    const passwordHash = await hashPassword(password);
    const uid = `u_${crypto.randomUUID()}`;

    // Role LUÔN là 'user'. Đây là endpoint công khai, nên tuyệt đối không đọc
    // `role` từ body — nếu không, bất kỳ ai cũng tự đăng ký được tài khoản admin.
    const inserted = await pool.query(
      `INSERT INTO users (uid, email, name, avatar_url, bio, phone, role, password_hash, fcm_token)
       VALUES ($1, $2, $3, $4, $5, $6, 'user', $7, $8)
       RETURNING ${PUBLIC_USER_COLUMNS}`,
      [
        uid,
        normalizedEmail,
        normalizedName,
        avatar_url || null,
        bio || null,
        phone || null,
        passwordHash,
        fcmToken || null,
      ]
    );

    const user = inserted.rows[0];

    // Đăng ký xong đăng nhập luôn, tránh bắt người dùng nhập lại mật khẩu.
    const accessToken = signAccessToken(user);
    const refreshToken = await issueRefreshToken({
      uid: user.uid,
      userAgent: req.headers["user-agent"],
    });

    return res.status(201).json({
      success: true,
      message: "Đăng ký thành công",
      access_token: accessToken,
      refresh_token: refreshToken,
      token: accessToken, // Giữ tên cũ để client hiện tại không vỡ
      user,
    });
  } catch (error) {
    console.error("Lỗi khi đăng ký:", error);
    // 23505 = unique_violation, xảy ra khi hai request đăng ký cùng email chạy
    // song song và cùng vượt qua bước kiểm tra tồn tại ở trên.
    if (error.code === "23505") {
      return res.status(400).json({ error: "Email này đã được đăng ký" });
    }
    return res.status(500).json({ error: "Lỗi khi đăng ký tài khoản" });
  }
};

module.exports = register;
