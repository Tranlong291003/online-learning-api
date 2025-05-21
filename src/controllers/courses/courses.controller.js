// controllers/courses/courses.controller.js
const getAllCourses = require("./getAllCourses");
const getCourseById = require("./getCourseById");
const createCourse = require("./createCourse");
const updateCourse = require("./updateCourse");
const deleteCourse = require("./deleteCourse");
const changeCourseStatus = require("./changeCourseStatus");
const getMentorCourses = require("./getMentorCourses");

module.exports = {
  getAllCourses,
  getCourseById,
  createCourse,
  updateCourse,
  deleteCourse,
  changeCourseStatus,
  getMentorCourses,
};
