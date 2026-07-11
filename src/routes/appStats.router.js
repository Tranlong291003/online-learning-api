const express = require("express");
const router = express.Router();
const appStatsController = require("../controllers/appStats.controller");
const authMiddleware = require("../middleware/auth.middleware");

/**
 * @swagger
 * tags: [{ name: AppStats, description: Thong ke dashboard (admin/mentor) } ]
 */
router.use(authMiddleware);

/**
 * @swagger
 * /api/app-stats:
 *   post:
 *     summary: Thong ke app
 *     tags: [AppStats]
 *     responses: { 200: { description: OK } }
 */
router.post("/", appStatsController.getStats);

module.exports = router;
