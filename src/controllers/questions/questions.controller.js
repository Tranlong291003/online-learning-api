const createQuestionManual = require("./createQuestionManual");
const createQuestionFromAi = require("./createQuestionFromAi");
const deleteQuestion = require("./deleteQuestion");
const getQuestionsByQuiz = require("./getQuestionsByQuiz");
const updateQuestion = require("./updateQuestion");

module.exports = {
  createQuestionFromAi,
  createQuestionManual,
  deleteQuestion,
  getQuestionsByQuiz,
  updateQuestion,
};
