// controllers/lessons/lessons.controller.js
const createLesson = require("./createLesson");
const updateLesson = require("./updateLesson");
const deleteLesson = require("./deleteLesson");
const getAllLessons = require("./getAllLessons");
const getLessonDetail = require("./getLessonDetail");
const completeLesson = require("./completeLesson");

module.exports = {
  createLesson,
  updateLesson,
  deleteLesson,
  getAllLessons,
  getLessonDetail,
  completeLesson,
};
