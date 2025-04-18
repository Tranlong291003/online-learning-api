const { sql, poolPromise } = require("../../config/db.config");

const updateLesson = async (req, res) => {
  const { lesson_id } = req.params;
  const {
    title,
    video_url,
    pdf_url,
    slide_url,
    content,
    order,
    is_preview,
    uid,
  } = req.body;

  if (!uid) {
    return res.status(400).json({ error: "UID không hợp lệ" });
  }

  try {
    const pool = await poolPromise; // Sử dụng poolPromise để kết nối
    const request = new sql.Request(pool);

    // Kiểm tra quyền của người dùng
    request.input("uid", sql.NVarChar, uid);
    const roleQuery = await request.query(
      `SELECT role FROM users WHERE uid = @uid`
    );

    const userRole = roleQuery.recordset[0]?.role;

    // Kiểm tra quyền cập nhật bài học (Admin hoặc Giảng viên)
    if (userRole !== "admin" && userRole !== "giang_vien") {
      return res.status(403).json({
        error: "Bạn không có quyền cập nhật bài học",
      });
    }

    // Lấy dữ liệu hiện tại của bài học
    request.input("lesson_id", sql.Int, lesson_id);
    const currentResult = await request.query(`
      SELECT * FROM lessons WHERE lesson_id = @lesson_id
    `);

    if (currentResult.recordset.length === 0) {
      return res
        .status(404)
        .json({ error: "Không tìm thấy bài học để cập nhật" });
    }

    const current = currentResult.recordset[0];

    // Merge dữ liệu mới vào dữ liệu hiện tại
    const updatedTitle = title ?? current.title;
    const updatedVideoUrl = video_url ?? current.video_url;
    const updatedPdfUrl = pdf_url ?? current.pdf_url;
    const updatedSlideUrl = slide_url ?? current.slide_url;
    const updatedContent = content ?? current.content;
    const updatedOrder = order ?? current.order;
    const updatedIsPreview =
      typeof is_preview === "boolean" ? is_preview : current.is_preview;

    // Thực hiện truy vấn cập nhật bài học
    const updateRequest = new sql.Request(pool);
    updateRequest.input("lesson_id", sql.Int, lesson_id);
    updateRequest.input("title", sql.NVarChar, updatedTitle);
    updateRequest.input("video_url", sql.NVarChar, updatedVideoUrl);
    updateRequest.input("pdf_url", sql.NVarChar, updatedPdfUrl);
    updateRequest.input("slide_url", sql.NVarChar, updatedSlideUrl);
    updateRequest.input("content", sql.NVarChar, updatedContent);
    updateRequest.input("order", sql.Int, updatedOrder);
    updateRequest.input("is_preview", sql.Bit, updatedIsPreview);

    await updateRequest.query(`
      UPDATE lessons
      SET
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

    // Lấy thông tin bài học sau khi cập nhật
    const updated = await updateRequest.query(`
      SELECT * FROM lessons WHERE lesson_id = @lesson_id
    `);

    // Trả về thông tin bài học đã cập nhật
    res.status(200).json({
      message: "Cập nhật bài học thành công",
      data: updated.recordset[0],
    });
  } catch (err) {
    res.status(500).json({
      error: "Lỗi cập nhật bài học: " + err.message,
    });
  }
};

module.exports = updateLesson;
