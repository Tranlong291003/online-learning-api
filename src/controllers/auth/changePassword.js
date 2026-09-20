const { verifyPassword, hashPassword, validatePassword } = require("../../services/passwordService");
const { setPasswordHash, findUserForLogin } = require("../../services/authUserLookup");
const { revokeAllForUser } = require("../../services/tokenService");

/**
 * Đổi mật khẩu cho người đang đăng nhập.
 *
 * Bắt buộc nhập mật khẩu hiện tại: access token có thể bị lộ (thiết bị dùng
 * chung, token trong log), nếu chỉ cần token là đổi được mật khẩu thì kẻ có
 * token chiếm được tài khoản vĩnh viễn.
 *
 * Sau khi đổi, thu hồi MỌI refresh token: nếu tài khoản đã bị chiếm, đổi mật
 * khẩu sẽ đá kẻ tấn công ra khỏi mọi thiết bị.
 */
const changePassword = async (req, res) => {
  const { current_password: currentPassword, new_password: newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Thiếu mật khẩu hiện tại hoặc mật khẩu mới" });
  }

  if (currentPassword === newPassword) {
    return res.status(400).json({ error: "Mật khẩu mới phải khác mật khẩu hiện tại" });
  }

  const passwordCheck = validatePassword(newPassword);
  if (!passwordCheck.valid) {
    return res.status(400).json({ error: passwordCheck.error });
  }

  try {
    const user = await findUserForLogin(req.user.email);
    if (!user) {
      return res.status(404).json({ error: "Không tìm thấy người dùng" });
    }

    const matches = await verifyPassword(currentPassword, user.password_hash);
    if (!matches) {
      return res.status(401).json({ error: "Mật khẩu hiện tại không đúng" });
    }

    const newHash = await hashPassword(newPassword);
    await setPasswordHash(user.uid, newHash);
    await revokeAllForUser(user.uid);

    return res.json({
      success: true,
      message: "Đổi mật khẩu thành công. Vui lòng đăng nhập lại trên các thiết bị khác.",
    });
  } catch (error) {
    console.error("Lỗi khi đổi mật khẩu:", error);
    return res.status(500).json({ error: "Lỗi khi đổi mật khẩu" });
  }
};

module.exports = changePassword;
