const express = require("express");
const router = express.Router();
const authenticateToken = require("../middlewares/authMiddleware.js"); // Import middleware

const courseCategoryController = require("../controllers/courseCategories/courseCategories.controller");

router.get("/", authenticateToken, courseCategoryController.getAllCategories);

router.post("/create", courseCategoryController.createCategory);

router.put("/update/:category_id", courseCategoryController.updateCategory);

router.delete("/delete/:category_id", courseCategoryController.deleteCategory);

module.exports = router;
