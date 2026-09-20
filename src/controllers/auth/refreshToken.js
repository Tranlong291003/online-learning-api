const {
  findRefreshToken,
  rotateRefreshToken,
  revokeFamily,
} = require("../../services/tokenService");
const { getPublicProfile } = require("../../services/authUserLookup");

/**
 * Đổi refresh token lấy access token mới.
 *
 * Có rotation: mỗi lần refresh sinh refresh token mới và thu hồi token cũ. Nhờ
 * vậy nếu token bị đánh cắp, kẻ tấn công và người dùng thật sẽ dùng cùng một
 * token ở hai thời điểm khác nhau — lần dùng thứ hai sẽ lộ ra.
 */
const refreshToken = async (req, res) => {
  const { refresh_token: rawToken } = req.body;

  if (!rawToken) {
    return res.status(400).json({ error: "Thiếu refresh token" });
  }

  try {
    const stored = await findRefreshToken(rawToken);

    if (!stored) {
      return res.status(401).json({ error: "Refresh token không hợp lệ" });
    }

    // Dùng lại một token đã thu hồi/đã rotate là dấu hiệu token bị đánh cắp.
    // Phản ứng đúng là vô hiệu hoá TOÀN BỘ họ token (mọi thiết bị trong phiên
    // đó), buộc đăng nhập lại — không chỉ từ chối riêng request này.
    if (stored.revoked_at) {
      console.warn(
        `Phát hiện refresh token đã thu hồi được dùng lại (uid=${stored.uid}). Thu hồi cả họ token.`
      );
      await revokeFamily(stored.family_id);
      return res
        .status(401)
        .json({ error: "Phiên đăng nhập không còn hiệu lực", code: "SESSION_REVOKED" });
    }

    if (new Date(stored.expires_at) <= new Date()) {
      return res
        .status(401)
        .json({ error: "Refresh token đã hết hạn", code: "REFRESH_TOKEN_EXPIRED" });
    }

    const user = await getPublicProfile(stored.uid);
    if (!user) {
      return res.status(401).json({ error: "Tài khoản không tồn tại" });
    }
    if (user.is_active === false) {
      await revokeFamily(stored.family_id);
      return res.status(403).json({ error: "Tài khoản đã bị khoá" });
    }

    const rotated = await rotateRefreshToken({
      currentToken: stored,
      user,
    });

    return res.status(200).json({
      success: true,
      access_token: rotated.accessToken,
      refresh_token: rotated.refreshToken,
      token: rotated.accessToken, // Giữ tên cũ để client hiện tại không vỡ
    });
  } catch (error) {
    console.error("Lỗi khi làm mới token:", error);
    return res.status(500).json({ error: "Lỗi khi làm mới token" });
  }
};

module.exports = refreshToken;
