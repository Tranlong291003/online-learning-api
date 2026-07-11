// controllers/courses/createCourse.js
// Mentor tao khoa hoc moi (trang thai mac dinh: pending)
const { insertRows, selectRows, supabaseAdmin } = require("../../services/supabase.service");
const { uploadBuffer, removeObject } = require("../../services/supabaseStorage.service");

const randomStr = () => Math.random().toString(36).slice(2, 8);

const createCourse = async (req, res) => {
  let uploadedKey = null;
  try {
    const { title, description, category_id, price, level, discount_price } = req.body;
    const instructor_uid = req.supabaseUser?.authUser?.id;

    if (!instructor_uid) return res.status(401).json({ error: "Chưa đăng nhập" });
    if (!title || !title.trim()) return res.status(400).json({ error: "Vui lòng nhập tiêu đề khóa học" });
    if (!description || !description.trim()) return res.status(400).json({ error: "Vui lòng nhập mô tả" });
    if (!category_id) return res.status(400).json({ error: "Vui lòng chọn danh mục" });

    // Kiem tra danh muc ton tai
    const { data: cat, error: catErr } = await selectRows(
      supabaseAdmin, "course_categories", "category_id",
      { eq: { category_id: Number(category_id) }, single: true }
    );
    if (catErr) throw catErr;
    if (!cat) return res.status(404).json({ error: "Danh mục không tồn tại" });

    // Upload thumbnail neu co
    let thumbnail_url = null;
    if (req.file && req.file.buffer) {
      const ext = (req.file.originalname || "").split(".").pop() || "jpg";
      const key = `courses/${Date.now()}-${randomStr()}.${ext}`;
      uploadedKey = key;
      const contentType = req.file.mimetype || "image/jpeg";
      thumbnail_url = await uploadBuffer("uploads", key, req.file.buffer, contentType);
    }

    const { data: inserted, error: insErr } = await insertRows(
      supabaseAdmin, "courses", {
        title: title.trim(),
        description: description.trim(),
        category_id: Number(category_id),
        instructor_uid,
        price: price ? Number(price) : 0,
        discount_price: discount_price ? Number(discount_price) : null,
        level: level || "beginner",
        thumbnail_url,
        status: "pending",
      }
    );
    if (insErr) {
      if (uploadedKey) await removeObject("uploads", uploadedKey).catch(() => {});
      throw insErr;
    }

    res.status(201).json({
      message: "Tạo khóa học thành công, đang chờ duyệt",
      data: inserted && inserted[0] ? inserted[0] : null,
    });
  } catch (err) {
    if (uploadedKey) await removeObject("uploads", uploadedKey).catch(() => {});
    console.error("createCourse error:", err);
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

module.exports = createCourse;

