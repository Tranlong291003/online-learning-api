/**
 * Tra cứu trạng thái user cho middleware xác thực.
 *
 * Tách riêng khỏi middleware để:
 *  - middleware không phụ thuộc trực tiếp vào db.config (dễ mock trong test), và
 *  - có một chỗ duy nhất để thêm cache nếu sau này cần giảm tải DB.
 *
 * Trả về { role, is_active } hoặc null nếu uid không tồn tại trong DB.
 */
const { pool } = require("../config/db.config");

async function getAuthStateForUid(uid) {
  if (!uid) return null;
  const result = await pool.query(
    "SELECT role, is_active FROM users WHERE uid = $1",
    [uid]
  );
  if (result.rows.length === 0) return null;
  return { role: result.rows[0].role, is_active: result.rows[0].is_active };
}

module.exports = { getAuthStateForUid };
