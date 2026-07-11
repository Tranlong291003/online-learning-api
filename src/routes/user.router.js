const express = require("express");
const router = express.Router();
const usersController = require("../controllers/users/users.controller");
const upload = require("../config/multer.user.config");
const checkUserStatus = require("../controllers/users/checkUserStatus");
const authMiddleware = require("../middleware/auth.middleware");

/**
 * @swagger
 * tags:
 *   - name: Users
 *     description: Quản lý người dùng (admin, mentor, user)
 */

/**
 * @swagger
 * /api/users/create:
 *   post:
 *     summary: Tạo user mới (admin)
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, name]
 *             properties:
 *               email: { type: string, example: user@example.com }
 *               password: { type: string, example: P@ssw0rd! }
 *               name: { type: string, example: Nguyễn Văn A }
 *               role: { type: string, enum: [user, mentor, admin] }
 *     responses:
 *       201: { description: Đã tạo thành công }
 *       400: { description: Yêu cầu không hợp lệ }
 */
router.post("/create", usersController.createUser);

/**
 * @swagger
 * /api/users/login:
 *   post:
 *     summary: Đăng nhập (Supabase Auth)
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string }
 *               password: { type: string }
 *     responses:
 *       200: { description: Thành công }
 *       401: { description: Sai thông tin đăng nhập }
 */
router.post("/login", usersController.loginUser);

router.use(authMiddleware);

/**
 * @swagger
 * /api/users/listmentor:
 *   get:
 *     summary: Lấy danh sách mentor
 *     tags: [Users]
 *     responses:
 *       200: { description: Thành công }
 */
router.get("/listmentor", usersController.getAllMentors);

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Lấy tất cả user (admin)
 *     tags: [Users]
 *     parameters:
 *       - in: query
 *         name: role
 *         schema: { type: string, enum: [user, mentor, admin] }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200: { description: Thành công }
 */
router.get("/", usersController.getAllUsers);

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Lấy chi tiết user
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Thành công }
 *       404: { description: Không tìm thấy }
 */
router.get("/:id", usersController.getUserById);

/**
 * @swagger
 * /api/users/{id}/status:
 *   patch:
 *     summary: Cập nhật trạng thái active (admin)
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               is_active: { type: boolean }
 *     responses:
 *       200: { description: Thành công }
 */
router.patch("/:id/status", usersController.updateUserStatus);

/**
 * @swagger
 * /api/users/delete/{id}:
 *   delete:
 *     summary: Xóa user (admin)
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Thành công }
 */
router.delete("/delete/:id", usersController.deleteUser);

/**
 * @swagger
 * /api/users/update/{id}:
 *   put:
 *     summary: Cập nhật profile (có thể upload avatar)
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               bio: { type: string }
 *               phone: { type: string }
 *               avatar: { type: string, format: binary }
 *     responses:
 *       200: { description: Thành công }
 */
router.put("/update/:id", upload.single("avatar"), usersController.updateUser);

/**
 * @swagger
 * /api/users/updaterole:
 *   put:
 *     summary: Đổi role (admin)
 *     tags: [Users]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [uid, role]
 *             properties:
 *               uid: { type: string }
 *               role: { type: string, enum: [user, mentor, admin] }
 *     responses:
 *       200: { description: Thành công }
 */
router.put("/updaterole", usersController.updateRole);

/**
 * @swagger
 * /api/users/checkactive/{uid}:
 *   get:
 *     summary: Kiểm tra user còn active không
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: uid
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Thành công }
 */
router.get("/checkactive/:uid", checkUserStatus);

module.exports = router;
