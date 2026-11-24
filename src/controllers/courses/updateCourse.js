const { parsePositiveInt, parseOptionalInt } = require("../../utils/parseId");
const { COURSE_LEVELS } = require("../../utils/constants");
const { pool } = require("../../config/db.config");
const { sendServerError } = require("../../utils/errorResponse");
const { resolveActorUid } = require("../../middleware/actor");
const { deleteFiles } = require("../../services/fileStorage");

const updateCourse = async (req, res) => {
  const course_id = parsePositiveInt(req.params.course_id);
  
  // Tham số phải là số nguyên dương. Nếu để nguyên chuỗi, PostgreSQL
  // ném "invalid input syntax for type integer" và API trả 500 — trong khi
  // lỗi thật là "client gửi sai" nên phải là 400.
  if (!course_id) {
    return res.status(400).json({ error: "course_id không hợp lệ" });
  }
  const {
    title,
    description,
    level,
    price,
    discount_price,
    language,
    tags,
  } = req.body;

  // level phải nằm trong danh sách cho phép. createCourse đã kiểm tra, nhưng
  // endpoint sửa thì thiếu — nên client gửi "abc" sẽ ghi thẳng vào cột mà
  // không có thông báo lỗi, và các bộ lọc theo cấp độ sau đó không khớp.
  if (level != null && level !== "" && !COURSE_LEVELS.includes(level)) {
    return res.status(400).json({
      error: `Cấp độ không hợp lệ. Chỉ chấp nhận: ${COURSE_LEVELS.join(", ")}`,
    });
  }

  // price/discount_price là cột integer. Chuỗi không phải số ("abc") khiến
  // PostgreSQL ném lỗi cú pháp → 500, trong khi lỗi thật là client gửi sai.
  let priceValue;
  let discountPriceValue;
  try {
    priceValue = parseOptionalInt(price);
    discountPriceValue = parseOptionalInt(discount_price);
  } catch (err) {
    return res.status(400).json({ error: "price/discount_price phải là số nguyên không âm" });
  }

  // Giá giảm không được lớn hơn giá gốc (xem createCourse).
  if (
    priceValue != null &&
    discountPriceValue != null &&
    discountPriceValue > priceValue
  ) {
    return res.status(400).json({ error: "discount_price không được lớn hơn price" });
  }

  // Lấy uid từ token; chỉ admin mới được thao tác thay người khác
  const uid = resolveActorUid(req, res, req.body.uid);
  if (!uid) return;

  try {
    // Kiểm tra role
    const roleResult = await pool.query(
      "SELECT role FROM users WHERE uid = $1",
      [uid]
    );

    const userRole = roleResult.rows[0]?.role;

    if (userRole !== "admin" && userRole !== "mentor") {
      return res.status(403).json({ error: "Bạn không có quyền sửa khóa học" });
    }

    // Lấy dữ liệu hiện tại
    const currentResult = await pool.query(
      "SELECT * FROM courses WHERE course_id = $1",
      [course_id]
    );

    if (currentResult.rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy khóa học" });
    }

    const current = currentResult.rows[0];

    // Mentor chỉ được sửa khóa học của chính mình
    if (userRole === "mentor" && current.instructor_uid !== uid) {
      return res.status(403).json({
        error: "Bạn không có quyền sửa khóa học của người khác",
      });
    }

    // Merge dữ liệu (file mới đã được lưu vào CSDL, dùng publicPath)
    const newThumbnailUrl = req.file ? req.file.publicPath : current.thumbnail_url;

    const updatedTitle = title ?? current.title;
    const updatedDescription = description ?? current.description;
    const updatedLevel = level ?? current.level;
    // Chỉ ghi đè giá khi client thực sự gửi lên. Dùng `priceValue` (đã ép số)
    // chứ không dùng `price` thô, để giá trị gửi lên luôn được kiểm tra ở trên.
    const updatedPrice = price !== undefined ? priceValue : current.price;
    const updatedDiscountPrice =
      discount_price !== undefined ? discountPriceValue : current.discount_price;
    const updatedLanguage = language ?? current.language;
    const updatedTags = tags ?? current.tags;

    // Kiểm tra trên giá trị SAU merge: client có thể chỉ gửi `discount_price`,
    // khi đó phải so với `price` hiện có trong DB.
    if (
      updatedPrice != null &&
      updatedDiscountPrice != null &&
      Number(updatedDiscountPrice) > Number(updatedPrice)
    ) {
      return res.status(400).json({ error: "discount_price không được lớn hơn price" });
    }

    // Update
    const updateResult = await pool.query(
      `UPDATE courses
       SET title = $1, description = $2, level = $3, price = $4,
           discount_price = $5, language = $6, tags = $7,
           thumbnail_url = $8, updated_at = NOW()
       WHERE course_id = $9
       RETURNING *`,
      [
        updatedTitle,
        updatedDescription,
        updatedLevel,
        updatedPrice,
        updatedDiscountPrice,
        updatedLanguage,
        updatedTags,
        newThumbnailUrl,
        course_id,
      ]
    );

    res.status(200).json({
      message: "Cập nhật khóa học thành công",
      data: updateResult.rows[0],
    });

    // Dọn thumbnail cũ sau khi đã trả response: nếu không, mỗi lần đổi ảnh bìa
    // lại để lại một bản ghi vĩnh viễn trong uploaded_files.
    if (req.file && current.thumbnail_url && current.thumbnail_url !== newThumbnailUrl) {
      deleteFiles([current.thumbnail_url]).catch(() => {});
    }
  } catch (err) {
    sendServerError(res, "Lỗi cập nhật khóa học", err);
  }
};

module.exports = updateCourse;
