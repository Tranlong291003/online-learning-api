/**
 * Ép route param thành số nguyên dương.
 * Trả về null nếu không hợp lệ, để controller trả 400 thay vì để PostgreSQL
 * ném lỗi "invalid input syntax for type integer" và rò rỉ chi tiết DB ra client.
 */
function parsePositiveInt(value) {
  if (value === undefined || value === null || value === "") return null;
  const str = String(value).trim();
  if (!/^\d+$/.test(str)) return null;
  const num = Number(str);
  return Number.isSafeInteger(num) && num > 0 ? num : null;
}

module.exports = { parsePositiveInt };
