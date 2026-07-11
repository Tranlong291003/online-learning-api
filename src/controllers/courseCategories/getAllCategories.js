// controllers/courseCategories/getAllCategories.js
const { selectRows, supabaseAdmin } = require("../../services/supabase.service");

const getAllCategories = async (req, res) => {
  try {
    const { data: cats, error } = await selectRows(
      supabaseAdmin,
      "course_categories",
      "category_id, name, description, icon, created_at, updated_at",
      { order: { col: "name", ascending: true } }
    );
    if (error) throw error;

    // PostgREST không hỗ trợ GROUP BY, đếm courses theo category_id
    const { data: counts, error: countErr } = await supabaseAdmin
      .from("courses")
      .select("category_id");
    if (countErr) throw countErr;

    const countMap = {};
    for (const row of counts || []) {
      if (row.category_id == null) continue;
      countMap[row.category_id] = (countMap[row.category_id] || 0) + 1;
    }

    const data = (cats || []).map((c) => ({
      ...c,
      course_count: countMap[c.category_id] || 0,
    }));

    res.status(200).json({
      message: "Lấy danh mục cùng số lượng khóa học thành công",
      data,
    });
  } catch (err) {
    console.error("Error fetching categories with course count:", err);
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

module.exports = getAllCategories;
