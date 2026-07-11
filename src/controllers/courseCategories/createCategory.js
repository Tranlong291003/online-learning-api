// controllers/courseCategories/createCategory.js
const { insertRows, selectRows, supabaseAdmin } = require("../../services/supabase.service");
const { uploadBuffer, removeObject } = require("../../services/supabaseStorage.service");

const randomStr = () => Math.random().toString(36).slice(2, 8);

const createCategory = async (req, res) => {
  let uploadedKey = null;
  try {
    const { name, description } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: "Vui lòng nhập tên danh mục" });

    // Kiem tra trung ten
    const { data: existed, error: findErr } = await supabaseAdmin
      .from("course_categories")
      .select("category_id")
      .ilike("name", name.trim())
      .maybeSingle();
    if (findErr) throw findErr;
    if (existed) return res.status(409).json({ error: "Tên danh mục đã tồn tại" });

    let image_url = null;
    if (req.file && req.file.buffer) {
      const ext = (req.file.originalname || "").split(".").pop() || "jpg";
      const key = `categories/${Date.now()}-${randomStr()}.${ext}`;
      uploadedKey = key;
      const contentType = req.file.mimetype || "image/jpeg";
      image_url = await uploadBuffer("uploads", key, req.file.buffer, contentType);
    }

    const { data: inserted, error: insErr } = await insertRows(supabaseAdmin, "course_categories", {
      name: name.trim(),
      description: description ? description.trim() : null,
      image_url,
    });
    if (insErr) {
      if (uploadedKey) await removeObject("uploads", uploadedKey).catch(() => {});
      throw insErr;
    }
    res.status(201).json({
      message: "Tạo danh mục thành công",
      data: inserted && inserted[0] ? inserted[0] : null,
    });
  } catch (err) {
    if (uploadedKey) await removeObject("uploads", uploadedKey).catch(() => {});
    console.error("createCategory error:", err);
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

module.exports = createCategory;

