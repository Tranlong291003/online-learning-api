const { sql, poolConnect, pool } = require("../../config/db.config");

const createLesson = async (req, res) => {
  const {
    course_id,
    title,
    video_url,
    pdf_url,
    slide_url,
    content,
    order,
    is_preview,
  } = req.body;

  if (!course_id || !title) {
    return res.status(400).json({
      error: "Các trường course_id và title là bắt buộc",
    });
  }

  try {
    await poolConnect;
    const request = new sql.Request(pool);

    request.input("course_id", sql.Int, course_id);
    request.input("title", sql.NVarChar, title);
    request.input("video_url", sql.NVarChar, video_url || null);
    request.input("pdf_url", sql.NVarChar, pdf_url || null);
    request.input("slide_url", sql.NVarChar, slide_url || null);
    request.input("content", sql.NVarChar, content || null);
    request.input("order", sql.Int, order ?? null);
    request.input(
      "is_preview",
      sql.Bit,
      typeof is_preview === "boolean" ? is_preview : null
    );

    await request.query(`
      INSERT INTO lessons (
        course_id,
        title,
        video_url,
        pdf_url,
        slide_url,
        content,
        [order],
        is_preview,
        created_at
      )
      VALUES (
        @course_id,
        @title,
        @video_url,
        @pdf_url,
        @slide_url,
        @content,
        @order,
        @is_preview,
        GETDATE()
      )
    `);

    res.status(201).json({
      message: "Tạo bài học mới thành công",
    });
  } catch (err) {
    res.status(500).json({
      error: "Lỗi tạo bài học: " + err.message,
    });
  }
};
module.exports = createLesson;
