const multer = require("multer");
const path = require("path");
const fs = require("fs");

// 📁 Thư mục lưu icon cho category
const categoryUploadDir = path.join(__dirname, "../public/uploads/categories");

// Tạo thư mục nếu chưa tồn tại
if (!fs.existsSync(categoryUploadDir)) {
  fs.mkdirSync(categoryUploadDir, { recursive: true });
}

const categoryStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, categoryUploadDir),
  filename: (req, file, cb) => {
    // dùng categoryId từ params, nếu không có thì đặt tên mặc định 'category'
    const categoryId = req.params.id || "category";
    const ext = path.extname(file.originalname);
    cb(null, `${categoryId}-${Date.now()}${ext}`);
  },
});

const uploadCategoryIcon = multer({
  storage: categoryStorage,
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

module.exports = uploadCategoryIcon;
