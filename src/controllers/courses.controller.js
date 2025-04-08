const { sql, poolConnect, pool } = require("../config/db.config");

exports.getAllCourses = async (req, res) => {
  try {
    await poolConnect;
    const request = new sql.Request(pool);

    const query = `
      SELECT
        course_id,
        courses.title,
        courses.price,
        courses.discount_price,
        courses.thumbnail_url,
        courses.updated_at,
        users.display_name AS instructor_name,
        course_categories.name AS category_name
      FROM courses
      LEFT JOIN users ON courses.instructor_id = users.user_id
      LEFT JOIN course_categories ON courses.category_id = course_categories.category_id
    `;

    const result = await request.query(query);

    res.status(200).json({
      message: "Lấy danh sách khóa học thành công",
      data: result.recordset,
    });
  } catch (err) {
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

exports.getCourseById = async (req, res) => {
  const { course_id } = req.params;
  try {
    await poolConnect;
    const request = new sql.Request(pool);
    request.input("course_id", sql.Int, course_id);

    const result = await request.query(`
      SELECT
        courses.course_id,
        courses.title,
        courses.description,
        courses.level,
        courses.price,
        courses.discount_price,
        courses.status,
        courses.approved_at,
        courses.language,
        courses.tags,
        courses.thumbnail_url,
        courses.created_at,
        courses.updated_at,
        courses.category_id,
        courses.instructor_id,
        users.display_name AS instructor_name,
        course_categories.name AS category_name
      FROM courses
      LEFT JOIN users ON courses.instructor_id = users.user_id
      LEFT JOIN course_categories ON courses.category_id = course_categories.category_id
      WHERE courses.course_id = @course_id
    `);

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
    discount_price,
    status, // Có thể có hoặc không
    language,
    tags,
    thumbnail_url,
  } = req.body;

  // Kiểm tra các trường bắt buộc
  if (!title || !instructor_id || !category_id) {
    return res
      .status(400)
      .json({ error: "Tên, giảng viên và danh mục là bắt buộc" });
  }

  try {
    await poolConnect;
    const request = new sql.Request(pool);

    // Nếu status không được gửi lên, gán mặc định là "chua_duyet"
    const finalStatus = status || "chua_duyet";

    // Các input cần thiết
    request.input("title", sql.NVarChar, title);
    request.input("description", sql.NVarChar, description || null);
    request.input("instructor_id", sql.Int, instructor_id);
    request.input("category_id", sql.Int, category_id);
    request.input("level", sql.NVarChar, level || null);
    request.input("price", sql.Int, price || null);
    request.input("discount_price", sql.Int, discount_price || null);
    request.input("status", sql.NVarChar, finalStatus);
    request.input("language", sql.NVarChar, language || null);
    request.input("tags", sql.NVarChar, tags || null);
    request.input("thumbnail_url", sql.NVarChar, thumbnail_url || null);

    // Thực hiện insert
    await request.query(`
      INSERT INTO courses (
        title,
        description,
        instructor_id,
        category_id,
        level,
        price,
        discount_price,
        status,
        language,
        tags,
        thumbnail_url,
        created_at,
        approved_at,
        updated_at
      )
      VALUES (
        @title,
        @description,
        @instructor_id,
        @category_id,
        @level,
        @price,
        @discount_price,
        @status,
        @language,
        @tags,
        @thumbnail_url,
        GETDATE(),
        NULL,
        NULL
      )
    `);

    res.status(201).json({ message: "Tạo khóa học mới thành công" });
  } catch (err) {
    res.status(500).json({ error: "Lỗi tạo khóa học: " + err.message });
  }
};

exports.updateCourse = async (req, res) => {
  const { course_id } = req.params;
  const {
    title,
    description,
    level,
    price,
    discount_price,
    language,
    tags,
    thumbnail_url,
  } = req.body;

  try {
    await poolConnect;
    const request = new sql.Request(pool);
    request.input("course_id", sql.Int, course_id);

    // 1. Lấy dữ liệu hiện tại
    const currentResult = await request.query(`
      SELECT * FROM courses WHERE course_id = @course_id
    `);

    if (currentResult.recordset.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy khóa học" });
    }

    const current = currentResult.recordset[0];

    // 2. Merge với dữ liệu mới (nếu không truyền thì giữ nguyên)
    const updatedTitle = title ?? current.title;
    const updatedDescription = description ?? current.description;
    const updatedLevel = level ?? current.level;
    const updatedPrice = price ?? current.price;
    const updatedDiscountPrice = discount_price ?? current.discount_price;
    const updatedLanguage = language ?? current.language;
    const updatedTags = tags ?? current.tags;
    const updatedThumbnailUrl = thumbnail_url ?? current.thumbnail_url;

    // 3. Chuẩn bị query update
    const updateRequest = new sql.Request(pool);
    updateRequest.input("course_id", sql.Int, course_id);
    updateRequest.input("title", sql.NVarChar, updatedTitle);
    updateRequest.input("description", sql.NVarChar, updatedDescription);
    updateRequest.input("level", sql.NVarChar, updatedLevel);
    updateRequest.input("price", sql.Int, updatedPrice);
    updateRequest.input("discount_price", sql.Int, updatedDiscountPrice);
    updateRequest.input("language", sql.NVarChar, updatedLanguage);
    updateRequest.input("tags", sql.NVarChar, updatedTags);
    updateRequest.input("thumbnail_url", sql.NVarChar, updatedThumbnailUrl);

    const result = await updateRequest.query(`
      UPDATE courses
      SET
        title = @title,
        description = @description,
        level = @level,
        price = @price,
        discount_price = @discount_price,
        language = @language,
        tags = @tags,
        thumbnail_url = @thumbnail_url,
        updated_at = GETDATE()
      WHERE course_id = @course_id
    `);

    const finalResult = await updateRequest.query(`
      SELECT * FROM courses WHERE course_id = @course_id
    `);

    res.status(200).json({
      message: "Cập nhật khóa học thành công",
      data: finalResult.recordset[0],
    });
  } catch (err) {
    res.status(500).json({
      error: "Lỗi cập nhật khóa học: " + err.message,
    });
  }
};

exports.changeCourseStatus = async (req, res) => {
  const { course_id } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ error: "Trạng thái khóa học là bắt buộc" });
  }

  try {
    await poolConnect;
    const request = new sql.Request(pool);

    request.input("course_id", sql.Int, course_id);
    request.input("status", sql.NVarChar, status);

    const isApproved = status.trim().toLowerCase() === "da_duyet";

    const result = await request.query(`
      UPDATE courses
      SET
        status = @status,
        approved_at = ${isApproved ? "GETDATE()" : "approved_at"},
        updated_at = GETDATE()
      WHERE course_id = @course_id
    `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({
        error: "Không tìm thấy khóa học để cập nhật trạng thái",
      });
    }

    const updatedCourse = await request.query(`
      SELECT * FROM courses WHERE course_id = @course_id
    `);

    res.status(200).json({
      message: "Cập nhật trạng thái khóa học thành công",
      data: updatedCourse.recordset[0],
    });
  } catch (err) {
    res.status(500).json({
      error: "Lỗi cập nhật trạng thái khóa học: " + err.message,
    });
  }
};

exports.deleteCourse = async (req, res) => {
  const { course_id } = req.params;

  try {
    await poolConnect;
    const request = new sql.Request(pool);
    request.input("course_id", sql.Int, course_id);
    const result = await request.query(
      "DELETE FROM courses WHERE course_id = @course_id"
    );

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: "Không tìm thấy khóa học để xoá" });
    }

    res.status(200).json({ message: "Xoá khóa học thành công" });
  } catch (err) {
    res.status(500).json({ error: "Lỗi xoá khóa học: " + err.message });
  }
};
