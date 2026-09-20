const { pool } = require("../../config/db.config");
const { sendServerError } = require("../../utils/errorResponse");
const { resolveActorUid } = require("../../middleware/actor");

const VALID_LEVELS = ["beginner", "intermediate", "advanced"];

const createCourse = async (req, res) => {
  const {
    title,
    description,
    category_id,
    level,
    price,
    discount_price,
    language,
    tags,
  } = req.body;

  if (!title || !category_id) {
    return res.status(400).json({ error: "Tên và danh mục là bắt buộc" });
  }

  // level không bắt buộc (cột nullable trong DB thật); chỉ validate khi có gửi lên
  if (level != null && level !== "" && !VALID_LEVELS.includes(level)) {
    return res.status(400).json({
      error: `Cấp độ không hợp lệ. Chỉ chấp nhận: ${VALID_LEVELS.join(", ")}`,
    });
  }

  // Lấy uid từ token; chỉ admin mới được thao tác thay người khác
  const uid = resolveActorUid(req, res, req.body.uid);
  if (!uid) return;

  try {
    // Kiểm tra user và role
    const userResult = await pool.query(
      "SELECT name, role FROM users WHERE uid = $1",
      [uid]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy người dùng" });
    }

    const { name: instructor_name, role: userRole } = userResult.rows[0];

    if (userRole !== "admin" && userRole !== "mentor") {
      return res.status(403).json({ error: "Bạn không có quyền tạo khóa học" });
    }

    // Kiểm tra danh mục tồn tại trước khi insert. Nếu bỏ bước này, category_id
    // không tồn tại sẽ vi phạm khoá ngoại và trả 500 kèm tên constraint nội bộ,
    // trong khi lỗi thật là "dữ liệu client gửi sai" (404).
    const categoryResult = await pool.query(
      "SELECT category_id FROM course_categories WHERE category_id = $1",
      [category_id]
    );
    if (categoryResult.rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy danh mục" });
    }

    // Xử lý thumbnail
    let thumbnail_url = null;
    if (req.file) {
      thumbnail_url = `/uploads/courses/${req.file.filename}`;
    }

    // Insert course
    const insertResult = await pool.query(
      `INSERT INTO courses (
        title, description, instructor_uid, category_id, level,
        price, discount_price, status, rejection_reason, language,
        tags, thumbnail_url, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
      RETURNING *`,
      [
        title,
        description || null,
        uid,
        category_id,
        level || null,
        price ?? null,
        discount_price ?? null,
        "pending",
        null,
        language || null,
        tags || null,
        thumbnail_url,
      ]
    );

    const course = insertResult.rows[0];

    res.status(201).json({
      message: "Tạo khóa học mới thành công",
      course: {
        ...course,
        instructor_name,
      },
    });
  } catch (err) {
    sendServerError(res, "Lỗi tạo khóa học", err);
  }
};

module.exports = createCourse;
