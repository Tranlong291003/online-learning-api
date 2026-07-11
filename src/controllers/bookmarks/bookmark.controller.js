// controllers/bookmarks/bookmark.controller.js
const createBookmark = require("./createBookmark");
const deleteBookmark = require("./deleteBookmark");
const getBookmarksByUser = require("./getBookmarksByUser");

module.exports = {
  createBookmark,
  deleteBookmark,
  getBookmarksByUser,
};
