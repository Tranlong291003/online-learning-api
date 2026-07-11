// controllers/reviews/reviews.controller.js
const createReview = require("./createReview");
const updateReview = require("./updateReview");
const deleteReview = require("./deleteReview");
const getReviewsByCourse = require("./getReviewsByCourse");

module.exports = {
  createReview,
  updateReview,
  deleteReview,
  getReviewsByCourse,
};
