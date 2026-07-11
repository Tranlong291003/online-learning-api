// controllers/quizzes/quizzes.controller.js
const createQuiz = require("./createQuiz");
const updateQuiz = require("./updateQuiz");
const deleteQuiz = require("./deleteQuiz");
const getQuizzesByCourse = require("./getQuizzesByCourse");
const getUserCoursesAndQuizzes = require("./getUserCoursesAndQuizzes");

module.exports = {
  createQuiz,
  updateQuiz,
  deleteQuiz,
  getQuizzesByCourse,
  getUserCoursesAndQuizzes,
};
