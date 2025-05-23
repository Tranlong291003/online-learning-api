const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth.middleware");

// Tất cả các route đều cần token
router.use(authMiddleware);

const reviewsController = require("../controllers/reviews/reviews.controller");

// Lấy review theo course
router.get("/course/:courseId", reviewsController.getReviewsByCourse);

// Tạo review
router.post("/create", reviewsController.createReview);

// Cập nhật review
router.put("/update/:reviewId", reviewsController.updateReview);

// Xóa review
router.delete("/delete/:reviewId", reviewsController.deleteReview);

module.exports = router;
