const { createUploader } = require("../services/fileStorage");

// Tài liệu bài học: PDF/PPT/PPTX (field "pdf" và "slide").
// Xem src/services/fileStorage.js để biết vì sao không dùng diskStorage nữa.
module.exports = createUploader({
  allowedExtensions: /\.(pdf|ppt|pptx)$/i,
  message: "Chỉ hỗ trợ file PDF, PPT, hoặc PPTX",
});
