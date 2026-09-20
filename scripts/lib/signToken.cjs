/**
 * Ký access token dùng cho các script kiểm tra thủ công.
 *
 * Middleware xác thực chốt cứng `issuer`, `audience` và thuật toán HS256, nên
 * token ký thiếu các tham số này sẽ bị từ chối (401) dù chữ ký đúng. Gom việc
 * ký token vào một chỗ để mọi script không phải tự nhớ từng tham số.
 *
 * Token ký ở đây là token THẬT, hợp lệ trên server đang chạy — chỉ dùng cho môi
 * trường phát triển, và cần JWT_SECRET trùng với secret của server đó.
 */
const jwt = require("jsonwebtoken");

const ISSUER = process.env.JWT_ISSUER || "online-learning-api";
const AUDIENCE = process.env.JWT_AUDIENCE || "online-learning-client";

/**
 * @param {object} payload Ít nhất phải có `uid` và `role`.
 * @param {object} [options]
 * @param {string} [options.expiresIn="1h"]
 * @param {string} [options.secret] Mặc định lấy từ process.env.JWT_SECRET.
 * @param {string} [options.audience] Ghi đè để test token sai audience.
 * @param {string} [options.issuer]
 */
function signToken(payload, options = {}) {
  const secret = options.secret || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("Thiếu JWT_SECRET — kiểm tra file .env");
  }

  return jwt.sign(
    { type: "access", ...payload },
    secret,
    {
      expiresIn: options.expiresIn || "1h",
      issuer: options.issuer || ISSUER,
      audience: options.audience || AUDIENCE,
      algorithm: "HS256",
    }
  );
}

/** Token đã hết hạn — để kiểm tra server có trả code TOKEN_EXPIRED không. */
function signExpiredToken(payload, options = {}) {
  return signToken(payload, { ...options, expiresIn: "-1h" });
}

/**
 * Token ký bằng khoá khác — để kiểm tra server từ chối chữ ký sai.
 * (Bản thân hàm này không cần JWT_SECRET của server.)
 */
function signTokenWithWrongSecret(payload) {
  return signToken(payload, { secret: "secret-sai-hoan-toan-khong-dung" });
}

module.exports = { signToken, signExpiredToken, signTokenWithWrongSecret, ISSUER, AUDIENCE };
