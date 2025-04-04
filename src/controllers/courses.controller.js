const { sql, poolConnect, pool } = require("../config/db.config");

exports.getAllCourses = async (req, res) => {
  try {
    await poolConnect;
    const request = new sql.Request(pool);
    const result = await request.query("SELECT * FROM courses");
    res.status(200).json({
      message: "Lấy danh sách khóa học thành công",
      data: result.recordset,
    });
  } catch (err) {
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

exports.getCourseById = async (req, res) => {
  const { id } = req.params;
  try {
    await poolConnect;
    const request = new sql.Request(pool);
    request.input("id", sql.Int, id);
    const result = await request.query("SELECT * FROM courses WHERE id = @id");

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy khóa học" });
    }

    res.status(200).json({
      message: "Lấy chi tiết khóa học thành công",
      data: result.recordset[0],
    });
  } catch (err) {
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

exports.createCourse = async (req, res) => {
  const {
    title,
    description,
    instructor_id,
    category_id,
    level,
    price,
    language,
    tags,
    thumbnail_url,
  } = req.body;

  if (!title || !instructor_id || !category_id) {
    return res
      .status(400)
      .json({ error: "Tên, giảng viên và danh mục là bắt buộc" });
  }

  try {
    await poolConnect;
    const request = new sql.Request(pool);
    request.input("title", sql.NVarChar, title);
    request.input("description", sql.NVarChar, description);
    request.input("instructor_id", sql.Int, instructor_id);
    request.input("category_id", sql.Int, category_id);
    request.input("level", sql.NVarChar, level);
    request.input("price", sql.Int, price);
    request.input("language", sql.NVarChar, language);
    request.input("tags", sql.NVarChar, tags);
    request.input("thumbnail_url", sql.NVarChar, thumbnail_url);

    await request.query(`
      INSERT INTO courses (title, description, instructor_id, category_id, level, price, language, tags, thumbnail_url, created_at)
      VALUES (@title, @description, @instructor_id, @category_id, @level, @price, @language, @tags, @thumbnail_url, GETDATE())
    `);

    res.status(201).json({ message: "Tạo khóa học mới thành công" });
  } catch (err) {
    res.status(500).json({ error: "Lỗi tạo khóa học: " + err.message });
  }
};

exports.updateCourse = async (req, res) => {
  const { id } = req.params;
  const { title, description, level, price, language, tags, thumbnail_url } =
    req.body;

  try {
    await poolConnect;
    const request = new sql.Request(pool);
    request.input("id", sql.Int, id);
    request.input("title", sql.NVarChar, title);
    request.input("description", sql.NVarChar, description);
    request.input("level", sql.NVarChar, level);
    request.input("price", sql.Int, price);
    request.input("language", sql.NVarChar, language);
    request.input("tags", sql.NVarChar, tags);
    request.input("thumbnail_url", sql.NVarChar, thumbnail_url);

    // Cập nhật thông tin khóa học
    const result = await request.query(`
      UPDATE courses
      SET title = @title, description = @description, level = @level, price = @price, language = @language, tags = @tags, thumbnail_url = @thumbnail_url, updated_at = GETDATE()
      WHERE id = @id
    `);

    // Kiểm tra nếu không tìm thấy khóa học để cập nhật
    if (result.rowsAffected[0] === 0) {
      return res
        .status(404)
        .json({ error: "Không tìm thấy khóa học để cập nhật" });
    }

    // Truy vấn lại khóa học đã được cập nhật
    const updatedCourse = await request.query(`
      SELECT * FROM courses WHERE id = @id
    `);

    res.status(200).json({
      message: "Cập nhật khóa học thành công",
      data: updatedCourse.recordset[0], // Trả về thông tin khóa học đã được cập nhật
    });
  } catch (err) {
    res.status(500).json({ error: "Lỗi cập nhật khóa học: " + err.message });
  }
};

exports.changeCourseStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  // Kiểm tra nếu trạng thái không được cung cấp
  if (!status) {
    return res.status(400).json({ error: "Trạng thái khóa học là bắt buộc" });
  }

  try {
    await poolConnect;
    const request = new sql.Request(pool);

    // Cung cấp tham số vào câu truy vấn
    request.input("id", sql.Int, id);
    request.input("status", sql.NVarChar, status);

    // Cập nhật trạng thái khóa học cùng với thời gian cập nhật
    const result = await request.query(`
      UPDATE courses
      SET status = @status, updated_at = GETDATE()
      WHERE id = @id
    `);

    // Kiểm tra xem có khóa học nào được cập nhật hay không
    if (result.rowsAffected[0] === 0) {
      return res
        .status(404)
        .json({ error: "Không tìm thấy khóa học để cập nhật trạng thái" });
    }

    // Truy vấn lại khóa học sau khi cập nhật trạng thái và thời gian cập nhật
    const updatedCourse = await request.query(`
      SELECT * FROM courses WHERE id = @id
    `);

    // Trả về thông báo và thông tin khóa học đã được cập nhật
    res.status(200).json({
      message: "Cập nhật trạng thái khóa học thành công",
      data: updatedCourse.recordset[0], // Trả về dữ liệu khóa học đã cập nhật
    });
  } catch (err) {
    // Xử lý lỗi
    res
      .status(500)
      .json({ error: "Lỗi cập nhật trạng thái khóa học: " + err.message });
  }
};

exports.deleteCourse = async (req, res) => {
  const { id } = req.params;

  try {
    await poolConnect;
    const request = new sql.Request(pool);
    request.input("id", sql.Int, id);
    const result = await request.query("DELETE FROM courses WHERE id = @id");

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: "Không tìm thấy khóa học để xoá" });
    }

    res.status(200).json({ message: "Xoá khóa học thành công" });
  } catch (err) {
    res.status(500).json({ error: "Lỗi xoá khóa học: " + err.message });
  }
};
