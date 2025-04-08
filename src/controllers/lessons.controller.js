const { sql, poolConnect, pool } = require("../config/db.config");

// 📘 Lấy tất cả bài học theo khóa học
exports.getAllLessons = async (req, res) => {
  const { course_id } = req.params;

  try {
    await poolConnect;
    const request = new sql.Request(pool);
    request.input("courseId", sql.Int, course_id);

    const result = await request.query(`
      SELECT * FROM lessons
      WHERE course_id = @courseId
      ORDER BY [order] ASC
    `);

    if (result.recordset.length === 0) {
      return res
        .status(404)
        .json({ error: "Không tìm thấy bài học cho khóa học này" });
    }

    res.status(200).json({
      message: "Lấy danh sách bài học thành công",
      data: result.recordset,
    });
  } catch (err) {
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

// 📝 Tạo bài học mới (chỉ gán created_at)
exports.createLesson = async (req, res) => {
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

// ✏️ Cập nhật bài học
exports.updateLesson = async (req, res) => {
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

// 🗑️ Xoá bài học
exports.deleteLesson = async (req, res) => {
  const { lesson_id } = req.params;

  try {
    await poolConnect;
    const request = new sql.Request(pool);
    request.input("lesson_id", sql.Int, lesson_id);

    const result = await request.query(`
      DELETE FROM lessons WHERE lesson_id = @lesson_id
    `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: "Không tìm thấy bài học để xoá" });
    }

    res.status(200).json({ message: "Xoá bài học thành công" });
  } catch (err) {
    res.status(500).json({ error: "Lỗi xoá bài học: " + err.message });
  }
};

exports.completeLesson = async (req, res) => {
  const { lesson_id } = req.params; // ID bài học từ URL
  const { user_id } = req.body; // ID người dùng từ body

  if (!user_id) {
    return res.status(400).json({ error: "Thiếu user_id" });
  }

  try {
    await poolConnect; // Đảm bảo kết nối đã được thiết lập
    const request = new sql.Request(pool);

    // Khai báo các tham số
    request.input("lesson_id", sql.Int, lesson_id);
    request.input("user_id", sql.Int, user_id);

    // Câu lệnh MERGE sẽ kiểm tra xem người dùng đã hoàn thành bài học này chưa
    await request.query(`
      MERGE lesson_progress AS target
      USING (SELECT @lesson_id AS lesson_id, @user_id AS user_id) AS source
      ON target.lesson_id = source.lesson_id AND target.user_id = source.user_id
      WHEN MATCHED THEN
        UPDATE SET is_completed = 1, completed_at = GETDATE()  -- Đánh dấu là hoàn thành
      WHEN NOT MATCHED THEN
        INSERT (lesson_id, user_id, is_completed, completed_at)
        VALUES (@lesson_id, @user_id, 1, GETDATE());  -- Thêm bài học mới nếu chưa có trong bảng
    `);

    res.status(200).json({ message: "Đã đánh dấu hoàn thành bài học" });
  } catch (err) {
    res.status(500).json({ error: "Lỗi đánh dấu hoàn thành: " + err.message });
  }
};
