// controllers/courseCategories/createCourse.js
const { sql, poolPromise } = require("../../config/db.config");

const createCourse = async (req, res) => {
  const {
    title,
    description,
    category_id,
    level,
    price,
    discount_price,
    status, // Có thể có hoặc không
    language,
    tags,
    thumbnail_url,
    uid, // Thêm uid vào để kiểm tra quyền người dùng
  } = req.body;

  // Kiểm tra các trường bắt buộc
  if (!title || !category_id) {
    return res.status(400).json({ error: "Tên và danh mục là bắt buộc" });
  }

  if (!uid) {
    return res.status(400).json({ error: "UID không được bỏ trống" });
  }

  try {
    // Kết nối cơ sở dữ liệu
    const pool = await poolPromise;
    const request = new sql.Request(pool);

    // Truy vấn để lấy instructor_id và name của giảng viên từ bảng users
    request.input("uid", sql.NVarChar, uid);
    const userQuery = await request.query(
      `SELECT user_id, name FROM users WHERE uid = @uid` // Truy vấn lấy user_id và name của giảng viên
    );

    // Nếu không tìm thấy người dùng
    if (userQuery.recordset.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy người dùng" });
    }

    const instructor_id = userQuery.recordset[0].user_id; // Sử dụng user_id làm instructor_id
    const instructor_name = userQuery.recordset[0].name; // Lấy tên giảng viên

    // Kiểm tra vai trò của người dùng
    const roleQuery = await request.query(
      `SELECT role FROM users WHERE uid = @uid`
    );

    const userRole = roleQuery.recordset[0]?.role;

    // Kiểm tra quyền của người dùng
    if (userRole !== "admin" && userRole !== "giang_vien") {
      return res.status(403).json({ error: "Bạn không có quyền tạo khóa học" });
    }

    // Nếu status không được gửi lên, gán mặc định là "chua_duyet"
    const finalStatus = status || "chua_duyet";

    // Các input cần thiết
    request.input("title", sql.NVarChar, title);
    request.input("description", sql.NVarChar, description || null);
    request.input("instructor_id", sql.Int, instructor_id); // Sử dụng instructor_id từ user_id
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

    // Truy vấn để lấy thông tin khóa học vừa tạo
    const courseQuery = await request.query(
      `SELECT * FROM courses WHERE title = @title AND instructor_id = @instructor_id ORDER BY created_at DESC`
    );

    // Lấy thông tin khóa học vừa tạo
    const course = courseQuery.recordset[0];

    // Trả về thông tin khóa học cùng với tên giảng viên
    res.status(201).json({
      message: "Tạo khóa học mới thành công",
      course: {
        ...course, // Thêm thông tin khóa học
        instructor_name: instructor_name, // Thêm tên giảng viên
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Lỗi tạo khóa học: " + err.message });
  }
};

module.exports = createCourse;
