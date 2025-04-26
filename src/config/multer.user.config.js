// src/config/multer.config.js

const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Thư mục lưu avatars
const uploadDir = path.join(__dirname, "../public/uploads/avatars");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uid = req.params.id;
    const ext = path.extname(file.originalname);
    cb(null, `${uid}-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /\.(jpe?g|png)$/i;
    if (allowed.test(file.originalname)) cb(null, true);
    else cb(new Error("Chỉ hỗ trợ JPEG/PNG"));
  },
});

module.exports = upload;
