// controllers/courseCategories/courseCategories.controller.js
const getAllCategories = require("./getAllCategories");
const createCategory = require("./createCategory");
const updateCategory = require("./updateCategory");
const deleteCategory = require("./deleteCategory");

module.exports = {
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
};
