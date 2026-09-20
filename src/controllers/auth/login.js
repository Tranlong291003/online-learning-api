const { pool } = require("../../config/db.config");
const { verifyPassword } = require("../../services/passwordService");
const {
  issueRefreshToken,
  signAccessToken,
} = require("../../services/tokenService");
const {
  PUBLIC_USER_COLUMNS,
  findUserForLogin,
  registerSuccessfulLogin,
  registerFailedLogin,
} = require("../../services/authUserLookup");
const { MAX_LOGIN_ATTEMPTS, LOGIN_LOCK_MINUTES } = require("../../config/auth.config");

const login = async (req, res) => {
  const { email, password, fcmToken, remember } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Thiếu email hoặc mật khẩu" });
  }

  try {
    const user = await findUserForLogin(email);

    // Mọi nhánh thất bại đều trả CÙNG một thông điệp. Phân biệt "email không
    // tồn tại" với "sai mật khẩu" sẽ biến API thành công cụ dò email đã đăng ký.
    const invalidCredentials = () =>
      res.status(401).json({ error: "Email hoặc mật khẩu không đúng" });

    if (!user) return invalidCredentials();

    if (user.is_active === false) {
      return res.status(403).json({ error: "Tài khoản đã bị khoá" });
    }

    // Kiểm tra tạm khoá do đăng nhập sai nhiều lần TRƯỚC khi so mật khẩu, để
    // không tốn CPU cho bcrypt khi tài khoản đang bị khoá.
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const remainingMs = new Date(user.locked_until).getTime() - Date.now();
      const remainingMinutes = Math.max(1, Math.ceil(remainingMs / 60000));
      return res.status(429).json({
        error: `Tài khoản tạm bị khoá do đăng nhập sai nhiều lần. Vui lòng thử lại sau ${remainingMinutes} phút`,
        code: "ACCOUNT_LOCKED",
      });
    }

    const passwordMatches = await verifyPassword(password, user.password_hash);

    if (!passwordMatches) {
      const lockedUntil = await registerFailedLogin(user.uid, {
        maxAttempts: MAX_LOGIN_ATTEMPTS,
        lockMinutes: LOGIN_LOCK_MINUTES,
      });

      if (lockedUntil) {
        return res.status(429).json({
          error: `Tài khoản tạm bị khoá do đăng nhập sai nhiều lần. Vui lòng thử lại sau ${LOGIN_LOCK_MINUTES} phút`,
          code: "ACCOUNT_LOCKED",
        });
      }

      return invalidCredentials();
    }

    await registerSuccessfulLogin(user.uid, fcmToken);

    const tokenPayload = { uid: user.uid, email: user.email, role: user.role };
    const accessToken = signAccessToken(tokenPayload);
    const refreshToken = await issueRefreshToken({
      uid: user.uid,
      remember: Boolean(remember),
      userAgent: req.headers["user-agent"],
    });

    // Lấy lại hồ sơ đầy đủ (đã cập nhật fcm_token) để trả về đồng nhất với /me.
    const profile = await pool.query(
      `SELECT ${PUBLIC_USER_COLUMNS} FROM users WHERE uid = $1`,
      [user.uid]
    );

    return res.status(200).json({
      success: true,
      message: "Đăng nhập thành công",
      access_token: accessToken,
      refresh_token: refreshToken,
      token: accessToken, // Giữ tên cũ để client hiện tại không vỡ
      user: profile.rows[0] || tokenPayload,
    });
  } catch (error) {
    console.error("Lỗi khi đăng nhập:", error);
    return res.status(500).json({ error: "Lỗi khi đăng nhập" });
  }
};

module.exports = login;
