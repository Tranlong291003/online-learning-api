const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/auth.middleware");
const register = require("../controllers/auth/register");
const login = require("../controllers/auth/login");
const refreshToken = require("../controllers/auth/refreshToken");
const logout = require("../controllers/auth/logout");
const me = require("../controllers/auth/me");
const changePassword = require("../controllers/auth/changePassword");
const {
  forgotPassword,
  resetPassword,
} = require("../controllers/auth/forgotPassword");

// ---------- Công khai (không cần token) ----------
router.post("/register", register);
router.post("/login", login);
// Refresh phải công khai: access token đã hết hạn mới cần gọi endpoint này.
router.post("/refresh", refreshToken);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

// ---------- Cần access token ----------
router.get("/me", authMiddleware, me);
router.post("/change-password", authMiddleware, changePassword);
// Đăng xuất cần token để xác định uid khi thu hồi toàn bộ thiết bị.
router.post("/logout", authMiddleware, logout);

module.exports = router;
