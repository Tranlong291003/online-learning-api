/**
 * Cấu hình xác thực tập trung.
 *
 * Tất cả tham số về thời hạn token, độ mạnh hash mật khẩu và khoá ký JWT nằm ở
 * một chỗ để không nơi nào tự đọc process.env rồi tự đặt mặc định riêng.
 */

// Access token ngắn hạn: vì JWT không thu hồi được giữa chừng, thời hạn ngắn là
// lớp bảo vệ chính. Hệ quả còn lại (token cũ vẫn dùng được tới khi hết hạn) được
// middleware xử lý bằng cách đối chiếu role/is_active với DB mỗi request.
const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || "15m";

// Refresh token dài hạn nhưng THU HỒI ĐƯỢC (lưu trong bảng refresh_tokens).
const REFRESH_TOKEN_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30);
// "Ghi nhớ đăng nhập" ở app mobile -> phiên sống lâu hơn.
const REFRESH_TOKEN_TTL_DAYS_REMEMBER = Number(
  process.env.REFRESH_TOKEN_TTL_DAYS_REMEMBER || 90
);

// bcrypt cost. 12 là mức cân bằng hợp lý cho máy chủ hiện nay; mỗi +1 là gấp đôi
// thời gian hash. Có thể giảm xuống 10 nếu CPU server yếu.
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 12);

// Độ dài tối thiểu của mật khẩu. Chặn ở tầng API để không phụ thuộc client.
const PASSWORD_MIN_LENGTH = Number(process.env.PASSWORD_MIN_LENGTH || 6);
// bcrypt chỉ dùng 72 byte đầu của mật khẩu; dài hơn thì phần thừa bị bỏ qua âm
// thầm, nên chặn hẳn để tránh người dùng tưởng mật khẩu dài là an toàn hơn.
const PASSWORD_MAX_LENGTH = 72;

const JWT_ISSUER = process.env.JWT_ISSUER || "online-learning-api";
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || "online-learning-client";

/** Số lần đăng nhập sai liên tiếp trước khi tạm khoá tài khoản. */
const MAX_LOGIN_ATTEMPTS = Number(process.env.MAX_LOGIN_ATTEMPTS || 10);
/** Thời gian tạm khoá sau khi vượt MAX_LOGIN_ATTEMPTS (phút). */
const LOGIN_LOCK_MINUTES = Number(process.env.LOGIN_LOCK_MINUTES || 15);

const VALID_ROLES = ["user", "mentor", "admin"];

/**
 * Lấy JWT_SECRET, ném lỗi rõ ràng nếu chưa cấu hình.
 *
 * Trả lỗi ngay lúc khởi động tốt hơn là để mọi request trả 500 rồi mới đi tìm
 * nguyên nhân, và tuyệt đối không được rơi về một khoá mặc định — khoá mặc định
 * trong mã nguồn đồng nghĩa với việc ai đọc được repo cũng ký được token hợp lệ.
 */
function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.trim().length === 0) {
    const error = new Error("JWT_SECRET chưa được cấu hình");
    error.code = "JWT_SECRET_MISSING";
    throw error;
  }
  return secret;
}

function isJwtSecretConfigured() {
  const secret = process.env.JWT_SECRET;
  return Boolean(secret && secret.trim().length > 0);
}

module.exports = {
  ACCESS_TOKEN_TTL,
  REFRESH_TOKEN_TTL_DAYS,
  REFRESH_TOKEN_TTL_DAYS_REMEMBER,
  BCRYPT_ROUNDS,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  JWT_ISSUER,
  JWT_AUDIENCE,
  MAX_LOGIN_ATTEMPTS,
  LOGIN_LOCK_MINUTES,
  VALID_ROLES,
  getJwtSecret,
  isJwtSecretConfigured,
};
