const express = require("express");
const router = express.Router();
const appStatsController = require("../controllers/appStats.controller");
const authMiddleware = require("../middleware/auth.middleware");

/**
 * @swagger
 * tags: [{ name: AppStats, description: Thống kê dashboard (admin/mentor) } ]
 */
router.use(authMiddleware);

/**
 * @swagger
 * /api/app-stats:
 *   post:
 *     summary: Thống kê tổng quan ứng dụng
 *     tags: [AppStats]
 *     responses: { 200: { description: Thành công } }
 */
router.post("/", appStatsController.getStats);

module.exports = router;
