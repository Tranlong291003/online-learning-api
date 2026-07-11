const express = require("express");
const router = express.Router();
const bokkmarksController = require("../controllers/bookmarks/bookmark.controller");
const authMiddleware = require("../middleware/auth.middleware");

/**
 * @swagger
 * tags: [{ name: Bookmarks, description: Đánh dấu khóa học yêu thích } ]
 */
router.use(authMiddleware);

/**
 * @swagger
 * /api/bookmarks/{user_uid}:
 *   get:
 *     summary: Lấy bookmark của user
 *     tags: [Bookmarks]
 *     parameters: [{ in: path, name: user_uid, required: true, schema: { type: string } }]
 *     responses: { 200: { description: Thành công } }
 */
router.get("/:user_uid", bokkmarksController.getBookmarksByUser);

/**
 * @swagger
 * /api/bookmarks/create:
 *   post:
 *     summary: Thêm bookmark
 *     tags: [Bookmarks]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [course_id]
 *             properties: { course_id: { type: integer } }
 *     responses: { 201: { description: Đã tạo thành công } }
 */
router.post("/create", bokkmarksController.createBookmark);

/**
 * @swagger
 * /api/bookmarks/delete:
 *   delete:
 *     summary: Xóa bookmark
 *     tags: [Bookmarks]
 *     parameters:
 *       - { in: query, name: user_uid, schema: { type: string } }
 *       - { in: query, name: course_id, schema: { type: integer } }
 *     responses: { 200: { description: Thành công } }
 */
router.delete("/delete", bokkmarksController.deleteBookmark);

module.exports = router;
