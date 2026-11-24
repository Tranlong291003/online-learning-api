/**
 * Hash và kiểm tra mật khẩu.
 *
 * ⚠️ Vì sao KHÔNG dùng bcrypt làm mặc định nữa:
 *
 * bcryptjs là JavaScript thuần, chạy đồng bộ và rất tốn CPU. Đo trên máy dev:
 * cost 12 tốn ~390ms cho MỘT lần hash/compare. Cloudflare Workers giới hạn CPU
 * mỗi request, nên trên production mọi request đăng nhập/đăng ký/đổi mật khẩu
 * đều có xác suất bị "Error 1102: Worker exceeded resource limits" — đo thực tế
 * cho thấy 10/15 lần đăng nhập thất bại.
 *
 * Ở đây dùng PBKDF2 qua Web Crypto (`crypto.subtle`), là API native có sẵn trên
 * cả Node 18+ lẫn Cloudflare Workers: đo được ~30ms cho 100.000 vòng SHA-256,
 * tức nhanh hơn bcrypt cost 12 khoảng 13 lần mà vẫn là hàm băm chậm có chủ đích
 * (chống dò mật khẩu).
 *
 * Tương thích ngược: hash bcrypt cũ (`$2a$`, `$2b$`, `$2y$`) vẫn verify được,
 * và sau khi verify thành công, `login` gọi `passwordNeedsRehash` để tự nâng cấp
 * sang định dạng mới. Nhờ vậy không cần migration và không user nào bị đăng xuất.
 */
const bcrypt = require("bcryptjs");
const {
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
} = require("../config/auth.config");

/**
 * Tham số PBKDF2.
 *
 * 100.000 vòng là mức OWASP khuyến nghị cho PBKDF2-HMAC-SHA256. Salt 16 byte
 * ngẫu nhiên cho mỗi mật khẩu để cùng một mật khẩu ra hash khác nhau.
 */
const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_HASH = "SHA-256";
const PBKDF2_KEYLEN = 32; // byte
const SALT_BYTES = 16;
/** Tiền tố nhận diện định dạng mới — khác hẳn `$2a$` của bcrypt. */
const PBKDF2_PREFIX = "pbkdf2_sha256";

/** `crypto.subtle` có trên Worker và Node 18+; ép về dạng thống nhất. */
const webcrypto =
  typeof globalThis.crypto !== "undefined" && globalThis.crypto.subtle
    ? globalThis.crypto
    : // Node cũ hơn hoặc môi trường không có global crypto
      require("node:crypto").webcrypto;

const encoder = new TextEncoder();

function bytesToBase64(bytes) {
  // Buffer có trên Node; Worker có `btoa`. Dùng btoa để chạy được cả hai.
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function base64ToBytes(b64) {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/**
 * Kiểm tra mật khẩu có hợp lệ về mặt hình thức không.
 * @returns {{valid: true} | {valid: false, error: string}}
 */
function validatePassword(password) {
  if (typeof password !== "string" || password.length === 0) {
    return { valid: false, error: "Thiếu mật khẩu" };
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return {
      valid: false,
      error: `Mật khẩu phải có ít nhất ${PASSWORD_MIN_LENGTH} ký tự`,
    };
  }
  if (Buffer.byteLength(password, "utf8") > PASSWORD_MAX_LENGTH) {
    return {
      valid: false,
      error: `Mật khẩu không được vượt quá ${PASSWORD_MAX_LENGTH} byte`,
    };
  }
  return { valid: true };
}

/** Hash mật khẩu bằng PBKDF2 → `pbkdf2_sha256$<iterations>$<salt_b64>$<hash_b64>`. */
async function hashPassword(password) {
  const salt = webcrypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const key = await webcrypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await webcrypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: PBKDF2_HASH,
    },
    key,
    PBKDF2_KEYLEN * 8
  );
  return [
    PBKDF2_PREFIX,
    PBKDF2_ITERATIONS,
    bytesToBase64(salt),
    bytesToBase64(new Uint8Array(bits)),
  ].join("$");
}

/** So sánh hai chuỗi base64 theo thời gian hằng để tránh timing attack. */
function timingSafeEqualB64(a, b) {
  const left = base64ToBytes(a);
  const right = base64ToBytes(b);
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i];
  return diff === 0;
}

async function verifyPbkdf2(password, hash) {
  const parts = hash.split("$");
  if (parts.length !== 4 || parts[0] !== PBKDF2_PREFIX) return false;
  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations < 1000) return false;

  const salt = base64ToBytes(parts[2]);
  const key = await webcrypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await webcrypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: PBKDF2_HASH },
    key,
    PBKDF2_KEYLEN * 8
  );
  return timingSafeEqualB64(parts[3], bytesToBase64(new Uint8Array(bits)));
}

/**
 * So sánh mật khẩu với hash.
 *
 * Trả false (không ném lỗi) khi hash rỗng/không hợp lệ: tài khoản cũ di trú từ
 * Firebase có password_hash NULL, và người dùng đó phải nhận "sai thông tin
 * đăng nhập" chứ không phải lỗi 500.
 */
async function verifyPassword(password, hash) {
  if (typeof hash !== "string" || hash.length === 0) return false;
  try {
    // Hash cũ dạng bcrypt: verify bằng bcrypt để không ai bị đăng xuất.
    if (/^\$2[aby]\$/.test(hash)) return await bcrypt.compare(password, hash);
    return await verifyPbkdf2(password, hash);
  } catch (error) {
    console.warn("Không so sánh được mật khẩu:", error.message);
    return false;
  }
}

/**
 * Hash này có nên được nâng cấp không.
 *
 * Dùng sau khi đăng nhập thành công: hash bcrypt cũ (hoặc PBKDF2 với số vòng
 * thấp hơn hiện tại) được thay bằng hash mới ngay trong lần đăng nhập đó, nên
 * dần dần cả hệ thống chuyển sang định dạng nhanh mà không cần migration.
 */
function passwordNeedsRehash(hash) {
  if (typeof hash !== "string" || hash.length === 0) return false;
  if (/^\$2[aby]\$/.test(hash)) return true;

  const parts = hash.split("$");
  if (parts.length !== 4 || parts[0] !== PBKDF2_PREFIX) return true;
  return Number(parts[1]) < PBKDF2_ITERATIONS;
}

module.exports = {
  validatePassword,
  hashPassword,
  verifyPassword,
  passwordNeedsRehash,
};
