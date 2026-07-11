// controllers/enrollments/enrollments.controller.js
// Gom cac handler thanh 1 object de routes/enrollments.router.js co the goi .method
const enrollCourse = require("./enrollCourse");
const deleteEnrollment = require("./deleteEnrollment");
const getCoursesByUser = require("./getCoursesByUser");
const checkEnrollStatus = require("./checkEnrollStatus");
const getCourseProgressForUser = require("./getCourseProgressForUser");

module.exports = {
  enrollCourse,
  deleteEnrollment,
  getCoursesByUser,
  checkEnrollStatus,
  getCourseProgressForUser,
};
