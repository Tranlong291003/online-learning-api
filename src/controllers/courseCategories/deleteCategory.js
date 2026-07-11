// controllers/courseCategories/deleteCategory.js
const {
  selectRows,
  deleteRows,
  supabaseAdmin,
} = require("../../services/supabase.service");

const deleteCategory = async (req, res) => {
  try {
    const { category_id } = req.params;
    const { uid } = req.body;

    if (!uid) return res.status(400).json({ error: "UID không được bỏ trống" });

    const { data: user, error: uErr } = await selectRows(
      supabaseAdmin,
      "users",
      "role",
      { eq: { uid }, single: true }
    );
    if (uErr) throw uErr;
    if (!user)
      return res.status(404).json({ error: "Không tìm thấy người dùng" });
    if (user.role !== "admin" && user.role !== "mentor") {
      return res.status(403).json({ error: "Bạn không có quyền xóa danh mục" });
    }

    const { error: delErr } = await deleteRows(
      supabaseAdmin,
      "course_categories",
      { category_id: Number(category_id) }
    );
    if (delErr) throw delErr;

    res.status(200).json({ message: "🗑️ Xóa danh mục thành công" });
  } catch (err) {
    res.status(500).json({ error: "❌ Lỗi xoá danh mục: " + err.message });
  }
};

module.exports = deleteCategory;
