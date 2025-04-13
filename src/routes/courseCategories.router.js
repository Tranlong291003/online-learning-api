const express = require("express");
const router = express.Router();
const courseCategoryController = require("../controllers/courseCategories/courseCategories.controller");

router.get("/course-categories", courseCategoryController.getAllCategories);

router.post("/course-categories", courseCategoryController.createCategory);

router.put(
  "/course-categories/:category_id",
  courseCategoryController.updateCategory
);

router.delete(
  "/course-categories/:category_id",
  courseCategoryController.deleteCategory
);

module.exports = router;
