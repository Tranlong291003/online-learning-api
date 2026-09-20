/**
 * Phân quyền theo role, khai báo ngay tại router.
 *
 * Trước đây mỗi controller tự `SELECT role FROM users` rồi if/else (khoảng 15
 * file, mỗi nơi một câu chữ lỗi khác nhau). Cách đó vừa lặp vừa dễ sót: chỉ cần
 * quên một nhánh là endpoint hở quyền, và không có chỗ nào để nhìn ra "route này
 * yêu cầu quyền gì".
 *
 * Ở đây quyền được khai báo tường minh cạnh route:
 *
 *   router.post("/create", authorize("admin", "mentor"), createCourse);
 *
 * Middleware CHỈ kiểm tra role — nó không truy vấn DB và không biết gì về dữ
 * liệu. Các quy tắc phụ thuộc dữ liệu (mentor chỉ sửa được khóa học của chính
 * mình, chủ sở hữu mới sửa được bài viết...) vẫn nằm trong controller vì cần
 * truy vấn mới biết.
 */
const { VALID_ROLES } = require("../config/auth.config");

const DEFAULT_MESSAGE = "Bạn không có quyền thực hiện thao tác này";

/**
 * @param {...string} allowedRoles Các role được phép.
 * @returns {import("express").RequestHandler}
 */
function authorize(...allowedRoles) {
  // Hỗ trợ dạng authorize(roles, { message }): tham số cuối là object tuỳ chọn.
  // Cho phép giữ nguyên câu chữ lỗi cũ của từng endpoint, tránh phá vỡ hợp đồng
  // API mà client (và test) đang dựa vào.
  let message = DEFAULT_MESSAGE;
  const last = allowedRoles[allowedRoles.length - 1];
  if (last && typeof last === "object") {
    allowedRoles = allowedRoles.slice(0, -1);
    if (typeof last.message === "string") message = last.message;
  }

  // Chặn lỗi gõ sai tên role ngay lúc khởi động thay vì âm thầm chặn hết request.
  for (const role of allowedRoles) {
    if (!VALID_ROLES.includes(role)) {
      throw new Error(
        `authorize() nhận role không hợp lệ: "${role}". Chỉ chấp nhận: ${VALID_ROLES.join(", ")}`
      );
    }
  }

  return (req, res, next) => {
    if (!req.user || !req.user.uid) {
      return res.status(401).json({ error: "Chưa xác thực" });
    }

    // Role lấy từ DB do authMiddleware gán (nguồn chân lý), không phải từ token.
    const role = req.user.role;

    if (allowedRoles.length === 0 || allowedRoles.includes(role)) {
      return next();
    }

    return res.status(403).json({ error: message });
  };
}

module.exports = { authorize, DEFAULT_MESSAGE };
