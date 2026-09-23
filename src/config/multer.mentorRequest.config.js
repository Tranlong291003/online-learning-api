const { createUploader } = require("../services/fileStorage");

// Ảnh minh chứng khi yêu cầu nâng cấp mentor: chỉ JPEG/PNG.
// Xem src/services/fileStorage.js để biết vì sao không dùng diskStorage nữa.
module.exports = createUploader({
  allowedExtensions: /\.(jpe?g|png)$/i,
  message: "Chỉ hỗ trợ ảnh JPEG hoặc PNG",
});
