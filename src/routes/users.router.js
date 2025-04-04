const express = require("express");
const router = express.Router();
const controller = require("../controllers/users.controller");
const verifyToken = require("../middlewares/auth.middleware");

router.get("/", verifyToken, controller.getAllUsers);
router.post("/", verifyToken, controller.createUser);

module.exports = router;
