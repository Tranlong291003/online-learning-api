const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth.middleware");

/**
 * @swagger
 * tags: [{ name: Reviews, description: Danh gia khoa hoc } ]
 */
router.use(authMiddleware);

const reviewsController = require("../controllers/reviews/reviews.controller");

/**
 * @swagger
 * /api/reviews/course/{courseId}:
 *   get:
 *     summary: Lay danh gia theo khoa hoc
 *     tags: [Reviews]
 *     parameters: [{ in: path, name: courseId, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: OK } }
 */
router.get("/course/:courseId", reviewsController.getReviewsByCourse);

/**
 * @swagger
 * /api/reviews/create:
 *   post:
 *     summary: Tao danh gia
 *     tags: [Reviews]
 *     responses: { 201: { description: Created } }
 */
router.post("/create", reviewsController.createReview);

/**
 * @swagger
 * /api/reviews/update/{reviewId}:
 *   put:
 *     summary: Cap nhat danh gia
 *     tags: [Reviews]
 *     parameters: [{ in: path, name: reviewId, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: OK } }
 */
router.put("/update/:reviewId", reviewsController.updateReview);

/**
 * @swagger
 * /api/reviews/delete/{reviewId}:
 *   delete:
 *     summary: Xoa danh gia
 *     tags: [Reviews]
 *     parameters: [{ in: path, name: reviewId, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: OK } }
 */
router.delete("/delete/:reviewId", reviewsController.deleteReview);

module.exports = router;
