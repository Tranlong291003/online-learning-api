const express = require("express");
const router = express.Router();
const appStatsController = require("../controllers/appStats.controller");

// Không cần middleware xác thực
router.post("/", appStatsController.getStats);

module.exports = router;
