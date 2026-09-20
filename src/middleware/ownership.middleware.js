/**
 * Kiểm tra quyền sở hữu tài nguyên dựa trên tham số trên URL.
 *
 * Bổ trợ cho `authorize()`: `authorize` chỉ so role và không biết gì về dữ
 * liệu, còn ở đây so định danh người gọi với định danh trên URL.
 *
 * Cách dùng:
 *   router.get("/:id", authorizeSelfOrAdmin("id"), getUserById);
 *
 * Luôn là "hoặc admin": admin phải xem/sửa được hồ sơ của mọi người (màn quản
 * trị người dùng).
 */
const { resolveActorUid } = require("./actor");

/**
 * @param {string} paramName Tên route param chứa uid (thường là "id").
 * @param {string} [message] Câu chữ lỗi trả về khi không đủ quyền.
 */
function authorizeSelfOrAdmin(
  paramName = "id",
  message = "Bạn không có quyền truy cập thông tin người dùng khác"
) {
  return (req, res, next) => {
    if (!req.user || !req.user.uid) {
      return res.status(401).json({ error: "Chưa xác thực" });
    }

    if (req.user.role === "admin") return next();

    const targetUid = req.params[paramName];
    if (String(targetUid) !== String(req.user.uid)) {
      return res.status(403).json({ error: message });
    }

    return next();
  };
}

module.exports = { authorizeSelfOrAdmin, resolveActorUid };
