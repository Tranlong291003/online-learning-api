const multer = require("multer");
const path = require("path");
const fs = require("fs");

// 📁 Thư mục lưu thumbnail khóa học
const courseUploadDir = path.join(__dirname, "../public/uploads/courses");

if (!fs.existsSync(courseUploadDir)) {
  fs.mkdirSync(courseUploadDir, { recursive: true });
}

const courseStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, courseUploadDir),
  filename: (req, file, cb) => {
    const courseId = req.params.id || "course";
    const ext = path.extname(file.originalname);
    cb(null, `${courseId}-${Date.now()}${ext}`);
  },
});

const uploadCourseThumbnail = multer({
  storage: courseStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const allowed = /\.(jpe?g|png)$/i;
    if (allowed.test(file.originalname)) cb(null, true);
    else cb(new Error("Chỉ hỗ trợ ảnh JPEG hoặc PNG"));
  },
});

module.exports = uploadCourseThumbnail;
