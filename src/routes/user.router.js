const express = require("express");
const router = express.Router();
const usersController = require("../controllers/users/users.controller");
const upload = require("../config/multer.user.config");
const checkUserStatus = require("../controllers/users/checkUserStatus");
const authMiddleware = require("../middleware/auth.middleware");
const { authorize } = require("../middleware/authorize.middleware");
const { authorizeSelfOrAdmin } = require("../middleware/ownership.middleware");

// Các route dưới đây đều cần token.
//
// Lưu ý: đăng ký / đăng nhập / làm mới token đã chuyển sang /api/auth/*
// (xem src/routes/auth.router.js). Hai route POST /create và POST /login ở đây
// được giữ lại làm alias tương thích ngược cho app đang chạy, và trỏ về cùng
// logic của /api/auth để không tồn tại hai bản cài đặt song song.
const register = require("../controllers/auth/register");
const login = require("../controllers/auth/login");

router.post("/create", register);
router.post("/login", login);

router.use(authMiddleware);

// Mọi user đã đăng nhập đều xem được danh sách mentor.
router.get("/listmentor", usersController.getAllMentors);

// Quản trị người dùng: chỉ admin.
router.get(
  "/",
  authorize("admin", { message: "Bạn không có quyền xem danh sách người dùng" }),
  usersController.getAllUsers
);
router.patch(
  "/:id/status",
  authorize("admin", { message: "Bạn không có quyền cập nhật trạng thái người dùng" }),
  usersController.updateUserStatus
);
router.put(
  "/updaterole",
  authorize("admin", { message: "Bạn không có quyền thay đổi vai trò" }),
  usersController.updateRole
);
router.delete(
  "/delete/:id",
  authorize("admin", { message: "Bạn không có quyền xoá người dùng" }),
  usersController.deleteUser
);

// Hồ sơ công khai: ai đã đăng nhập cũng xem được (màn "chi tiết mentor" của học
// viên cần email/sđt/bio của người dạy). Chỉ trả các trường công khai.
router.get("/:id", usersController.getPublicProfile);

// Sửa hồ sơ: chỉ chính chủ hoặc admin.
router.put(
  "/update/:id",
  authorizeSelfOrAdmin("id", "Bạn không có quyền cập nhật người dùng này"),
  upload.single("avatar"),
  usersController.updateUser
);

// Kiểm tra tài khoản còn hoạt động: chỉ chính chủ hoặc admin. Endpoint này lộ
// trạng thái bị khoá nên không được để công khai.
router.get("/checkactive/:uid", authorizeSelfOrAdmin("uid"), checkUserStatus);

module.exports = router;
