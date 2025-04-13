const { sql, poolConnect, pool } = require("../../config/db.config");

const updateLesson = async (req, res) => {
  const { lesson_id } = req.params;
  const { title, video_url, pdf_url, slide_url, content, order, is_preview } =
    req.body;

  try {
    await poolConnect;

    // Lấy dữ liệu hiện tại
    const getRequest = new sql.Request(pool);
    getRequest.input("lesson_id", sql.Int, lesson_id);
    const currentResult = await getRequest.query(`
      SELECT * FROM lessons WHERE lesson_id = @lesson_id
    `);

    if (currentResult.recordset.length === 0) {
      return res
        .status(404)
        .json({ error: "Không tìm thấy bài học để cập nhật" });
    }

    const current = currentResult.recordset[0];

    // Merge dữ liệu
    const updateRequest = new sql.Request(pool);
    updateRequest.input("lesson_id", sql.Int, lesson_id);
    updateRequest.input("title", sql.NVarChar, title ?? current.title);
    updateRequest.input(
      "video_url",
      sql.NVarChar,
      video_url ?? current.video_url
    );
    updateRequest.input("pdf_url", sql.NVarChar, pdf_url ?? current.pdf_url);
    updateRequest.input(
      "slide_url",
      sql.NVarChar,
      slide_url ?? current.slide_url
    );
    updateRequest.input("content", sql.NVarChar, content ?? current.content);
    updateRequest.input("order", sql.Int, order ?? current.order);
    updateRequest.input(
      "is_preview",
      sql.Bit,
      typeof is_preview === "boolean" ? is_preview : current.is_preview
    );

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

    const updated = await updateRequest.query(`
      SELECT * FROM lessons WHERE lesson_id = @lesson_id
    `);

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
