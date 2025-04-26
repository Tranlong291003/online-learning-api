const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Tạo thư mục nếu chưa tồn tại
const pdfDir = path.join(__dirname, "../public/uploads/lessons/pdf");
const slideDir = path.join(__dirname, "../public/uploads/lessons/slides");

[pdfDir, slideDir].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Cấu hình lưu file
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === "pdf") cb(null, pdfDir);
    else if (file.fieldname === "slide") cb(null, slideDir);
    else cb(new Error("Chỉ hỗ trợ upload pdf hoặc slide"));
  },
  filename: (req, file, cb) => {
    // Dùng tên gốc (original name), nhưng lọc bỏ ký tự đặc biệt
    const originalName = path.basename(file.originalname);
    const safeName = originalName.replace(/[^a-zA-Z0-9-_\.]/g, "_");
    cb(null, safeName);
  },
});

// Middleware multer
const uploadLessonFiles = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /\.(pdf|ppt|pptx)$/i;
    if (allowedTypes.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error("Chỉ hỗ trợ file PDF, PPT, hoặc PPTX"));
    }
  },
});

module.exports = uploadLessonFiles;
