// controllers/questions/questions.controller.js
const createQuestionManual = require("./createQuestionManual");
const createQuestionFromAi = require("./createQuestionFromAi");
const updateQuestion = require("./updateQuestion");
const deleteQuestion = require("./deleteQuestion");
const getQuestionsByQuiz = require("./getQuestionsByQuiz");

module.exports = {
  createQuestionManual,
  createQuestionFromAi,
  updateQuestion,
  deleteQuestion,
  getQuestionsByQuiz,
};
