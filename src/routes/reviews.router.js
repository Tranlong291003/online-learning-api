const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth.middleware");

/**
 * @swagger
 * tags: [{ name: Reviews, description: Đánh giá khóa học } ]
 */
router.use(authMiddleware);

const reviewsController = require("../controllers/reviews/reviews.controller");

/**
 * @swagger
 * /api/reviews/course/{courseId}:
 *   get:
 *     summary: Lấy đánh giá theo khóa học
 *     tags: [Reviews]
 *     parameters: [{ in: path, name: courseId, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: Thành công } }
 */
router.get("/course/:courseId", reviewsController.getReviewsByCourse);

/**
 * @swagger
 * /api/reviews/create:
 *   post:
 *     summary: Tạo đánh giá
 *     tags: [Reviews]
 *     responses: { 201: { description: Đã tạo thành công } }
 */
router.post("/create", reviewsController.createReview);

/**
 * @swagger
 * /api/reviews/update/{reviewId}:
 *   put:
 *     summary: Cập nhật đánh giá
 *     tags: [Reviews]
 *     parameters: [{ in: path, name: reviewId, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: Thành công } }
 */
router.put("/update/:reviewId", reviewsController.updateReview);

/**
 * @swagger
 * /api/reviews/delete/{reviewId}:
 *   delete:
 *     summary: Xóa đánh giá
 *     tags: [Reviews]
 *     parameters: [{ in: path, name: reviewId, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: Thành công } }
 */
router.delete("/delete/:reviewId", reviewsController.deleteReview);

module.exports = router;
