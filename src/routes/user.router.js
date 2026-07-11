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
 *     description: Quan ly nguoi dung (admin, mentor, user)
 */

/**
 * @swagger
 * /api/users/create:
 *   post:
 *     summary: Tao user moi (admin)
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
 *               name: { type: string, example: Nguyen Van A }
 *               role: { type: string, enum: [user, mentor, admin] }
 *     responses:
 *       201: { description: Created }
 *       400: { description: Bad request }
 */
router.post("/create", usersController.createUser);

/**
 * @swagger
 * /api/users/login:
 *   post:
 *     summary: Dang nhap (Supabase Auth)
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
 *       200: { description: OK }
 *       401: { description: Sai thong tin }
 */
router.post("/login", usersController.loginUser);

router.use(authMiddleware);

/**
 * @swagger
 * /api/users/listmentor:
 *   get:
 *     summary: Lay danh sach mentor
 *     tags: [Users]
 *     responses:
 *       200: { description: OK }
 */
router.get("/listmentor", usersController.getAllMentors);

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Lay tat ca user (admin)
 *     tags: [Users]
 *     parameters:
 *       - in: query
 *         name: role
 *         schema: { type: string, enum: [user, mentor, admin] }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200: { description: OK }
 */
router.get("/", usersController.getAllUsers);

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Lay chi tiet user
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: OK }
 *       404: { description: Not found }
 */
router.get("/:id", usersController.getUserById);

/**
 * @swagger
 * /api/users/{id}/status:
 *   patch:
 *     summary: Cap nhat trang thai active (admin)
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
 *       200: { description: OK }
 */
router.patch("/:id/status", usersController.updateUserStatus);

/**
 * @swagger
 * /api/users/delete/{id}:
 *   delete:
 *     summary: Xoa user (admin)
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: OK }
 */
router.delete("/delete/:id", usersController.deleteUser);

/**
 * @swagger
 * /api/users/update/{id}:
 *   put:
 *     summary: Cap nhat profile (co the upload avatar)
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
 *       200: { description: OK }
 */
router.put("/update/:id", upload.single("avatar"), usersController.updateUser);

/**
 * @swagger
 * /api/users/updaterole:
 *   put:
 *     summary: Doi role (admin)
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
 *       200: { description: OK }
 */
router.put("/updaterole", usersController.updateRole);

/**
 * @swagger
 * /api/users/checkactive/{uid}:
 *   get:
 *     summary: Kiem tra user con active khong
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: uid
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: OK }
 */
router.get("/checkactive/:uid", checkUserStatus);

module.exports = router;
