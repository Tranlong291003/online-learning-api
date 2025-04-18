const express = require("express");
const router = express.Router();
const usersController = require("../controllers/users/users.controller");

// Tạo người dùng mới
router.post("/create", usersController.createUser);

// Lấy danh sách người dùng
router.get("/", usersController.getAllUsers);

// Lấy chi tiết người dùng theo ID
router.get("/:id", usersController.getUserById);

// Cập nhật trạng thái tài khoản người dùng (Khóa hoặc mở tài khoản)
router.patch("/:id/status", usersController.updateUserStatus);

// Xóa người dùng
router.delete("/:id", usersController.deleteUser);
router.post("/login", usersController.loginUser);

module.exports = router;
