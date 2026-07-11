// Gom cac handler con lai cua courses thanh 1 controller object
const getAllCourses = require("./getAllCourses");
const getCourseById = require("./getCourseById");
const getMentorCourses = require("./getMentorCourses");
const createCourse = require("./createCourse");
const updateCourse = require("./updateCourse");
const deleteCourse = require("./deleteCourse");
const changeCourseStatus = require("./changeCourseStatus");

module.exports = {
  getAllCourses,
  getCourseById,
  getMentorCourses,
  createCourse,
  updateCourse,
  deleteCourse,
  changeCourseStatus,
};

