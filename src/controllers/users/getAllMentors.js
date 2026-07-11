// controllers/users/getAllMentors.js
// Public: lay mentor theo role='mentor' + is_active=true. Co the search theo name.
const { supabaseAdmin } = require("../../services/supabase.service");

const getAllMentors = async (req, res) => {
  try {
    const { search } = req.query;
    let query = supabaseAdmin
      .from("users")
      .select("uid, name, avatar_url, bio, role, is_active, phone, gender, created_at")
      .eq("role", "mentor")
      .eq("is_active", true)
      .order("name", { ascending: true });
    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      // PostgREST OR-like: name.ilike hoặc phone.ilike
      query = query.or(`name.ilike.${term},phone.ilike.${term}`);
    }
    const { data, error } = await query;
    if (error) throw error;
    res.status(200).json({
      message: "Danh sách mentor",
      mentors: (data || []).map((m) => ({ ...m, isActive: m.is_active })),
    });
  } catch (err) {
    console.error("getAllMentors error:", err);
    res.status(500).json({ error: "Lỗi khi lấy danh sách mentor: " + err.message });
  }
};

module.exports = getAllMentors;
