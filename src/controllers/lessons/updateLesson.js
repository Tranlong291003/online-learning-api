const { sql, poolPromise } = require("../../config/db.config");
const path = require("path");
const fs = require("fs");

const updateLesson = async (req, res) => {
  const { lesson_id } = req.params;
  const { title, video_url, content, order, is_preview, uid } = req.body;

  if (!uid) {
    return res.status(400).json({ error: "UID không hợp lệ" });
  }

  try {
    const pool = await poolPromise;

    // Kiểm tra vai trò
    const request = new sql.Request(pool);
    request.input("uid", sql.NVarChar, uid);
    const roleResult = await request.query(
      `SELECT role FROM users WHERE uid = @uid`
    );
    const userRole = roleResult.recordset[0]?.role;

    if (userRole !== "admin" && userRole !== "mentor") {
      return res
        .status(403)
        .json({ error: "Bạn không có quyền cập nhật bài học" });
    }

    // Lấy dữ liệu hiện tại
    request.input("lesson_id", sql.Int, lesson_id);
    const currentResult = await request.query(
      `SELECT * FROM lessons WHERE lesson_id = @lesson_id`
    );

    if (currentResult.recordset.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy bài học" });
    }

    const current = currentResult.recordset[0];

    // Xử lý file PDF & Slide (có xóa file cũ nếu upload mới)
    let newPdfUrl = current.pdf_url;
    let newSlideUrl = current.slide_url;

    if (req.files?.pdf?.[0]) {
      if (current.pdf_url) {
        const oldPdfPath = path.join(
          __dirname,
          "../../public",
          current.pdf_url
        );
        if (fs.existsSync(oldPdfPath)) fs.unlinkSync(oldPdfPath);
      }
      newPdfUrl = `/uploads/lessons/pdf/${req.files.pdf[0].filename}`;
    }

    if (req.files?.slide?.[0]) {
      if (current.slide_url) {
        const oldSlidePath = path.join(
          __dirname,
          "../../public",
          current.slide_url
        );
        if (fs.existsSync(oldSlidePath)) fs.unlinkSync(oldSlidePath);
      }
      newSlideUrl = `/uploads/lessons/slides/${req.files.slide[0].filename}`;
    }

    // Merge dữ liệu mới hoặc giữ nguyên
    const updatedTitle = title ?? current.title;
    const updatedVideoUrl = video_url ?? current.video_url;
    const updatedContent = content ?? current.content;
    const updatedOrder = order ?? current.order;
    const updatedIsPreview =
      typeof is_preview !== "undefined"
        ? is_preview === "true" || is_preview === true
        : current.is_preview;

    // Cập nhật DB
    const updateRequest = new sql.Request(pool);
    updateRequest.input("lesson_id", sql.Int, lesson_id);
    updateRequest.input("title", sql.NVarChar, updatedTitle);
    updateRequest.input("video_url", sql.NVarChar, updatedVideoUrl);
    updateRequest.input("pdf_url", sql.NVarChar, newPdfUrl);
    updateRequest.input("slide_url", sql.NVarChar, newSlideUrl);
    updateRequest.input("content", sql.NVarChar, updatedContent);
    updateRequest.input("order", sql.Int, updatedOrder);
    updateRequest.input("is_preview", sql.Bit, updatedIsPreview);

    await updateRequest.query(`
      UPDATE lessons SET
        title = @title,
        video_url = @video_url,
        pdf_url = @pdf_url,
        slide_url = @slide_url,
        content = @content,
        [order] = @order,
        is_preview = @is_preview,
        updated_at = GETDATE()
      WHERE lesson_id = @lesson_id
    `);

    // Trả về kết quả
    const finalResult = await updateRequest.query(`
      SELECT * FROM lessons WHERE lesson_id = @lesson_id
    `);

    res.status(200).json({
      message: "Cập nhật bài học thành công",
      data: finalResult.recordset[0],
    });
  } catch (err) {
    res.status(500).json({ error: "Lỗi cập nhật bài học: " + err.message });
  }
};

module.exports = updateLesson;
