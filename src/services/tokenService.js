/**
 * Phát hành và thu hồi token.
 *
 * Mô hình: access token là JWT ngắn hạn (không thu hồi được), refresh token là
 * giá trị ngẫu nhiên lưu trong DB (thu hồi được). Đăng xuất hay thu hồi quyền
 * đều tác động lên refresh token, còn access token tự hết hạn sau ít phút.
 */
const crypto = require("node:crypto");
const jwt = require("jsonwebtoken");
const { pool } = require("../config/db.config");
const {
  ACCESS_TOKEN_TTL,
  REFRESH_TOKEN_TTL_DAYS,
  REFRESH_TOKEN_TTL_DAYS_REMEMBER,
  JWT_ISSUER,
  JWT_AUDIENCE,
  getJwtSecret,
} = require("../config/auth.config");

/** Số byte ngẫu nhiên của refresh token (48 byte -> 64 ký tự base64url). */
const REFRESH_TOKEN_BYTES = 48;

function hashToken(rawToken) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

function generateRawToken() {
  return crypto.randomBytes(REFRESH_TOKEN_BYTES).toString("base64url");
}

/**
 * Ký access token.
 *
 * `role` được đưa vào token để tiện hiển thị, nhưng KHÔNG được dùng làm căn cứ
 * phân quyền: middleware luôn đối chiếu lại role với DB vì token sống tới 15
 * phút và quyền có thể đã bị thu hồi trong khoảng đó.
 */
function signAccessToken(user) {
  return jwt.sign(
    {
      uid: user.uid,
      email: user.email,
      role: user.role,
      type: "access",
    },
    getJwtSecret(),
    {
      expiresIn: ACCESS_TOKEN_TTL,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }
  );
}

/**
 * Verify access token. Ném lỗi của `jsonwebtoken` nếu không hợp lệ.
 * `algorithms` bị chốt cứng để chặn tấn công đổi thuật toán sang `none`.
 */
function verifyAccessToken(token) {
  return jwt.verify(token, getJwtSecret(), {
    algorithms: ["HS256"],
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });
}

/**
 * Tạo refresh token mới và lưu vào DB.
 *
 * @param {object} options
 * @param {string} options.uid
 * @param {string} [options.familyId] Dùng lại family khi rotate; bỏ trống khi đăng nhập mới.
 * @param {boolean} [options.remember] Phiên dài hạn ("ghi nhớ đăng nhập").
 * @param {string} [options.userAgent]
 * @returns {Promise<string>} token gốc (chỉ trả về đúng một lần, DB chỉ giữ hash)
 */
async function issueRefreshToken({ uid, familyId, remember, userAgent }) {
  const rawToken = generateRawToken();
  const ttlDays = remember
    ? REFRESH_TOKEN_TTL_DAYS_REMEMBER
    : REFRESH_TOKEN_TTL_DAYS;
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

  await pool.query(
    `INSERT INTO refresh_tokens (uid, token_hash, family_id, expires_at, user_agent)
     VALUES ($1, $2, COALESCE($3, gen_random_uuid()), $4, $5)`,
    [uid, hashToken(rawToken), familyId || null, expiresAt, userAgent || null]
  );

  return rawToken;
}

/**
 * Tra refresh token còn hiệu lực.
 *
 * Trả về cả token đã bị thu hồi/đã rotate để lớp gọi phát hiện việc dùng lại
 * token cũ, thay vì lặng lẽ trả null và mất dấu hiệu tấn công.
 */
async function findRefreshToken(rawToken) {
  const result = await pool.query(
    `SELECT token_id, uid, family_id, expires_at, revoked_at, user_agent
     FROM refresh_tokens
     WHERE token_hash = $1`,
    [hashToken(rawToken)]
  );
  return result.rows[0] || null;
}

async function revokeTokenById(tokenId, replacedBy = null) {
  await pool.query(
    `UPDATE refresh_tokens
     SET revoked_at = NOW(), replaced_by = $2
     WHERE token_id = $1 AND revoked_at IS NULL`,
    [tokenId, replacedBy]
  );
}

/** Thu hồi toàn bộ một họ token (một phiên đăng nhập trên một thiết bị). */
async function revokeFamily(familyId) {
  await pool.query(
    `UPDATE refresh_tokens
     SET revoked_at = NOW()
     WHERE family_id = $1 AND revoked_at IS NULL`,
    [familyId]
  );
}

/**
 * Thu hồi mọi phiên của một người dùng.
 * Dùng khi đổi/đặt lại mật khẩu, khi tài khoản bị khoá, hoặc khi admin đổi quyền.
 */
async function revokeAllForUser(uid) {
  await pool.query(
    `UPDATE refresh_tokens
     SET revoked_at = NOW()
     WHERE uid = $1 AND revoked_at IS NULL`,
    [uid]
  );
}

/**
 * Rotate refresh token: thu hồi token cũ và phát token mới cùng họ.
 *
 * @returns {Promise<{accessToken: string, refreshToken: string, user: object}>}
 */
async function rotateRefreshToken({ currentToken, user }) {
  const nextRaw = await issueRefreshToken({
    uid: user.uid,
    familyId: currentToken.family_id,
    remember: true,
    userAgent: currentToken.user_agent,
  });

  const inserted = await pool.query(
    "SELECT token_id FROM refresh_tokens WHERE token_hash = $1",
    [hashToken(nextRaw)]
  );

  await revokeTokenById(currentToken.token_id, inserted.rows[0]?.token_id || null);

  return {
    accessToken: signAccessToken(user),
    refreshToken: nextRaw,
  };
}

/** Dọn token hết hạn hoặc đã thu hồi quá lâu. Gọi định kỳ (cron) là đủ. */
async function cleanupExpiredTokens() {
  const result = await pool.query(
    `DELETE FROM refresh_tokens
     WHERE expires_at < NOW()
        OR (revoked_at IS NOT NULL AND revoked_at < NOW() - INTERVAL '7 days')`
  );
  return result.rowCount;
}

module.exports = {
  hashToken,
  signAccessToken,
  verifyAccessToken,
  issueRefreshToken,
  findRefreshToken,
  revokeTokenById,
  revokeFamily,
  revokeAllForUser,
  rotateRefreshToken,
  cleanupExpiredTokens,
};
