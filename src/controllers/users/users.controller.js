// controllers/users/users.controller.js
// Gom cac handler thanh 1 object de routes/user.router.js co the goi .method
const getAllUsers = require("./getAllUsers");
const getUserById = require("./getUserById");
const getAllMentors = require("./getAllMentors");
const updateUser = require("./updateUser");
const updateUserStatus = require("./updateUserStatus");
const checkUserStatus = require("./checkUserStatus");
const createUser = require("./createUser");
const loginUser = require("./loginUser");
const deleteUser = require("./deleteUser");
const updateRole = require("./updateRole");

module.exports = {
  getAllUsers,
  getUserById,
  getAllMentors,
  updateUser,
  updateUserStatus,
  checkUserStatus,
  createUser,
  loginUser,
  deleteUser,
  updateRole,
};
