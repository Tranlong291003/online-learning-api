const { createUploader } = require("../services/fileStorage");

// Thumbnail khoá học: chỉ JPEG/PNG, kiểm tra cả nội dung file.
// Xem src/services/fileStorage.js để biết vì sao không dùng diskStorage nữa.
module.exports = createUploader({
  allowedExtensions: /\.(jpe?g|png)$/i,
  message: "Chỉ hỗ trợ ảnh JPEG hoặc PNG",
});
