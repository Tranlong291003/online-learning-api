const express = require("express");
const router = express.Router();
const bokkmarksController = require("../controllers/bookmarks/bookmark.controller");
const authMiddleware = require("../middleware/auth.middleware");

/**
 * @swagger
 * tags: [{ name: Bookmarks, description: Danh dau khoa hoc yeu thich } ]
 */
router.use(authMiddleware);

/**
 * @swagger
 * /api/bookmarks/{user_uid}:
 *   get:
 *     summary: Lay bookmark cua user
 *     tags: [Bookmarks]
 *     parameters: [{ in: path, name: user_uid, required: true, schema: { type: string } }]
 *     responses: { 200: { description: OK } }
 */
router.get("/:user_uid", bokkmarksController.getBookmarksByUser);

/**
 * @swagger
 * /api/bookmarks/create:
 *   post:
 *     summary: Them bookmark
 *     tags: [Bookmarks]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [course_id]
 *             properties: { course_id: { type: integer } }
 *     responses: { 201: { description: Created } }
 */
router.post("/create", bokkmarksController.createBookmark);

/**
 * @swagger
 * /api/bookmarks/delete:
 *   delete:
 *     summary: Xoa bookmark
 *     tags: [Bookmarks]
 *     parameters:
 *       - { in: query, name: user_uid, schema: { type: string } }
 *       - { in: query, name: course_id, schema: { type: integer } }
 *     responses: { 200: { description: OK } }
 */
router.delete("/delete", bokkmarksController.deleteBookmark);

module.exports = router;
