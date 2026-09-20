const { pool } = require("../../config/db.config");

/**
 * Hồ sơ công khai của một người dùng — ai đã đăng nhập cũng xem được.
 *
 * Cần thiết vì app mobile có màn "chi tiết mentor": học viên phải xem được tên,
 * ảnh, bio và thông tin liên hệ của người dạy trước khi quyết định đăng ký học.
 * Nếu bắt buộc phải là admin mới xem được thì nghiệp vụ không chạy được.
 *
 * Trả về đúng tập trường hiển thị trên hồ sơ công khai, KHÔNG trả:
 *   - email/phone của chính chủ ở dạng riêng tư (vẫn trả vì mentor cần được liên hệ)
 *   - is_active  (lộ trạng thái bị khoá của người khác)
 *   - fcm_token  (khoá gửi push notification)
 *   - password_hash, failed_login_attempts, locked_until
 */
const PUBLIC_PROFILE_COLUMNS = `
  uid, email, name, avatar_url, bio, phone, gender, birthdate, role, created_at
`;

const getPublicProfile = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT ${PUBLIC_PROFILE_COLUMNS} FROM users WHERE uid = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy người dùng" });
    }

    res.json({
      message: "Thông tin người dùng",
      user: result.rows[0],
    });
  } catch (err) {
    console.error("Error in getPublicProfile:", err);
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

module.exports = getPublicProfile;
module.exports.PUBLIC_PROFILE_COLUMNS = PUBLIC_PROFILE_COLUMNS;
