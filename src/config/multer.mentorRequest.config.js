const multer = require("multer");
const path = require("path");
const fs = require("fs");

// 📁 Thư mục lưu ảnh minh chứng mentor
const mentorUploadDir = path.join(
  __dirname,
  "../public/uploads/mentor_requests"
);

// Tạo thư mục nếu chưa tồn tại
if (!fs.existsSync(mentorUploadDir)) {
  fs.mkdirSync(mentorUploadDir, { recursive: true });
}

const mentorRequestStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, mentorUploadDir),
  filename: (req, file, cb) => {
    const userUid = req.body.user_uid || "mentor";
    const ext = path.extname(file.originalname);
    cb(null, `${userUid}-${Date.now()}${ext}`);
  },
});

const uploadMentorRequestImage = multer({
  storage: mentorRequestStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const allowed = /\.(jpe?g|png)$/i;
    if (allowed.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error("Chỉ hỗ trợ ảnh JPEG hoặc PNG"));
    }
  },
});

module.exports = uploadMentorRequestImage;
