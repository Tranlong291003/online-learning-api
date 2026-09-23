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

/**
 * Ép một giá trị tuỳ chọn thành số nguyên không âm.
 *
 * Khác `parsePositiveInt` ở chỗ chấp nhận 0 (giá 0, giảm giá 0 là hợp lệ) và
 * coi giá trị rỗng/undefined/null là "không gửi lên" (trả về null mà không
 * phải lỗi).
 *
 * Dùng cho các trường số trong body như `price`, `discount_price`. Nếu để
 * nguyên chuỗi, PostgreSQL ném "invalid input syntax for type integer" và API
 * trả 500 — lỗi thật là dữ liệu client gửi sai nên phải là 400.
 *
 * @returns {number|null} số hợp lệ, null nếu không gửi lên
 * @throws {RangeError} khi có gửi lên nhưng không phải số nguyên không âm
 */
function parseOptionalInt(value) {
  if (value === undefined || value === null || value === "") return null;
  const str = String(value).trim();
  if (!/^\d+$/.test(str)) {
    throw new RangeError("giá trị phải là số nguyên không âm");
  }
  const num = Number(str);
  if (!Number.isSafeInteger(num) || num < 0) {
    throw new RangeError("giá trị phải là số nguyên không âm");
  }
  return num;
}

module.exports = { parsePositiveInt, parseOptionalInt };
