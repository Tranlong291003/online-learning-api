const { findRefreshToken, revokeFamily, revokeAllForUser } = require("../../services/tokenService");

/**
 * Đăng xuất.
 *
 * Body:
 *   - `refresh_token`: thu hồi riêng phiên của thiết bị này.
 *   - `all_devices: true`: thu hồi mọi phiên của người dùng.
 *
 * Không cần access token còn hạn để gọi endpoint này (nó vẫn đi qua
 * authMiddleware), nhưng refresh token là thứ thực sự chấm dứt phiên.
 */
const logout = async (req, res) => {
  const { refresh_token: rawToken, all_devices: allDevices } = req.body;
  const uid = req.user && req.user.uid;

  try {
    if (allDevices) {
      if (!uid) {
        return res.status(401).json({ error: "Chưa xác thực" });
      }
      await revokeAllForUser(uid);
      return res.json({ success: true, message: "Đã đăng xuất khỏi tất cả thiết bị" });
    }

    if (!rawToken) {
      return res.status(400).json({ error: "Thiếu refresh token" });
    }

    const stored = await findRefreshToken(rawToken);

    // Token không tồn tại hoặc của người khác -> coi như đã đăng xuất. Trả 200 để
    // thao tác đăng xuất luôn thành công từ góc nhìn client (idempotent), tránh
    // trường hợp app kẹt ở trạng thái "không đăng xuất được".
    if (!stored || (uid && stored.uid !== uid)) {
      return res.json({ success: true, message: "Đã đăng xuất" });
    }

    await revokeFamily(stored.family_id);

    return res.json({ success: true, message: "Đã đăng xuất" });
  } catch (error) {
    console.error("Lỗi khi đăng xuất:", error);
    return res.status(500).json({ error: "Lỗi khi đăng xuất" });
  }
};

module.exports = logout;
