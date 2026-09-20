// Tương thích ngược cho module cũ. Luồng đăng nhập chính thức nằm ở
// src/controllers/auth/login.js và được mount tại /api/auth/login.
//
// Lưu ý: trước đây file này xác thực `idToken` của Firebase rồi mới ký JWT. Từ
// khi API tự quản lý mật khẩu (bcrypt), tham số `idToken` không còn được dùng.
module.exports = require("../auth/login");
