const { getPublicProfile } = require("../../services/authUserLookup");

/**
 * Trả hồ sơ của chính người đang đăng nhập.
 *
 * App mobile dùng endpoint này lúc khởi động để khôi phục phiên: đọc token đã
 * lưu, gọi `/me`; nếu 200 thì vào thẳng app, nếu 401 thì về màn đăng nhập. Nhờ
 * vậy role luôn là role hiện tại trong DB chứ không phải role đóng băng trong
 * token.
 */
const me = async (req, res) => {
  try {
    const profile = await getPublicProfile(req.user.uid);

    if (!profile) {
      return res.status(404).json({ error: "Không tìm thấy người dùng" });
    }

    return res.json({
      success: true,
      user: profile,
      // Trả kèm role ở cấp cao nhất cho client chỉ cần đọc một trường.
      role: profile.role,
    });
  } catch (error) {
    console.error("Lỗi khi lấy thông tin người dùng:", error);
    return res.status(500).json({ error: "Lỗi khi lấy thông tin người dùng" });
  }
};

module.exports = me;
