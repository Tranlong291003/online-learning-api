// controllers/courseCategories/updateCategory.js
const { updateRows, selectRows, supabaseAdmin } = require("../../services/supabase.service");
const { uploadBuffer, removeObject } = require("../../services/supabaseStorage.service");

const randomStr = () => Math.random().toString(36).slice(2, 8);

const updateCategory = async (req, res) => {
  let uploadedKey = null;
  try {
    const { category_id } = req.params;
    const { name, description } = req.body;

    const { data: cat, error: findErr } = await selectRows(
      supabaseAdmin, "course_categories", "*",
      { eq: { category_id: Number(category_id) }, single: true }
    );
    if (findErr) throw findErr;
    if (!cat) return res.status(404).json({ error: "Không tìm thấy danh mục" });

    if (name && name.trim() && name.trim() !== cat.name) {
      const { data: dup } = await supabaseAdmin
        .from("course_categories")
        .select("category_id")
        .ilike("name", name.trim())
        .neq("category_id", Number(category_id))
        .maybeSingle();
      if (dup) return res.status(409).json({ error: "Tên danh mục đã tồn tại" });
    }

    const patch = {};
    if (name && name.trim()) patch.name = name.trim();
    if (description !== undefined) patch.description = description ? description.trim() : null;

    if (req.file && req.file.buffer) {
      const ext = (req.file.originalname || "").split(".").pop() || "jpg";
      const key = `categories/${Date.now()}-${randomStr()}.${ext}`;
      uploadedKey = key;
      const contentType = req.file.mimetype || "image/jpeg";
      const newUrl = await uploadBuffer("uploads", key, req.file.buffer, contentType);
      patch.image_url = newUrl;
      if (cat.image_url) await removeObject("uploads", cat.image_url).catch(() => {});
    }

    if (!Object.keys(patch).length) return res.status(200).json({ message: "Không có thay đổi", data: cat });

    const { error: updErr } = await updateRows(
      supabaseAdmin, "course_categories", patch, { category_id: Number(category_id) }
    );
    if (updErr) {
      if (uploadedKey) await removeObject("uploads", uploadedKey).catch(() => {});
      throw updErr;
    }

    const { data: fresh } = await selectRows(
      supabaseAdmin, "course_categories", "*",
      { eq: { category_id: Number(category_id) }, single: true }
    );
    res.status(200).json({ message: "Cập nhật danh mục thành công", data: fresh });
  } catch (err) {
    if (uploadedKey) await removeObject("uploads", uploadedKey).catch(() => {});
    console.error("updateCategory error:", err);
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

module.exports = updateCategory;

