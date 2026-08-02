const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth.middleware");
const appStatsController = require("../controllers/appStats.controller");

router.use(authMiddleware);
router.post("/", appStatsController.getStats);

module.exports = router;
