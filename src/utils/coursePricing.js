/**
 * Hằng số và hàm tính dùng chung cho khoá học.
 *
 * `discount_percent` trước đây được tính riêng ở `getCourseById` và
 * `getMentorCourses` bằng hai biểu thức giống nhau. Cùng một công thức ở hai
 * nơi nghĩa là sửa một chỗ dễ sót chỗ kia, và cả hai đều cho ra số ÂM khi dữ
 * liệu cũ có `discount_price > price` (chưa có validate lúc ghi).
 */

/**
 * Phần trăm giảm giá, luôn nằm trong 0–100.
 *
 * Trả 0 khi thiếu giá trị, khi giá gốc bằng 0/không hợp lệ, hoặc khi giá giảm
 * không nhỏ hơn giá gốc — tuyệt đối không trả số âm ra client.
 *
 * @param {number|string|null|undefined} price
 * @param {number|string|null|undefined} discountPrice
 * @returns {number} số nguyên 0–100
 */
function computeDiscountPercent(price, discountPrice) {
  const base = Number(price);
  const discounted = Number(discountPrice);

  if (!Number.isFinite(base) || !Number.isFinite(discounted)) return 0;
  if (base <= 0 || discounted <= 0 || discounted >= base) return 0;

  const percent = Math.round(((base - discounted) / base) * 100);
  return Math.min(100, Math.max(0, percent));
}

module.exports = { computeDiscountPercent };
