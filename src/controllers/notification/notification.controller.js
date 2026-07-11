// controllers/notification/notification.controller.js
const createNotification = require("./createNotification");
const updateNotification = require("./updateNotification");
const deleteNotification = require("./deleteNotification");
const getNotifications = require("./getNotifications");
const markAsRead = require("./markAsRead");

module.exports = {
  createNotification,
  updateNotification,
  deleteNotification,
  getNotifications,
  markAsRead,
};

