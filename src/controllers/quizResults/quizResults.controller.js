// controllers/quizResults/quizResults.controller.js
const submitQuizResult = require("./submitQuizResult");
const getResultsByUser = require("./getResultsByUser");
const getQuizResultById = require("./getQuizResultById");
const gradeQuizResult = require("./gradeQuizResult");

module.exports = {
  submitQuizResult,
  getResultsByUser,
  getQuizResultById,
  gradeQuizResult,
};
