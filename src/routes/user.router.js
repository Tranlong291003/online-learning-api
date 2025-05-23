const express = require("express");
const router = express.Router();
const usersController = require("../controllers/users/users.controller");
const upload = require("../config/multer.user.config");
const checkUserStatus = require("../controllers/users/checkUserStatus");
const authMiddleware = require("../middleware/auth.middleware");

// Đăng ký (signup) - KHÔNG cần token
router.post("/create", usersController.createUser);
// Đăng nhập (login) - KHÔNG cần token
router.post("/login", usersController.loginUser);

// Các route dưới đây đều cần token
router.use(authMiddleware);

router.get("/listmentor", usersController.getAllMentors);
router.get("/", usersController.getAllUsers);
router.get("/:id", usersController.getUserById);
router.patch("/:id/status", usersController.updateUserStatus);
router.delete("/delete/:id", usersController.deleteUser);
router.put("/update/:id", upload.single("avatar"), usersController.updateUser);
router.put("/updaterole", usersController.updateRole);
router.get("/checkactive/:uid", checkUserStatus);

module.exports = router;
