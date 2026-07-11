// controllers/users/getAllUsers.js
// Admin lay danh sach user. Ho tro search theo name/email va loc theo role.
const { supabaseAdmin } = require("../../services/supabase.service");

const getAllUsers = async (req, res) => {
  try {
    const { search, role } = req.query;
    let query = supabaseAdmin
      .from("users")
      .select("id, uid, name, email, avatar_url, role, bio, phone, is_active, gender, birthdate, created_at, updated_at")
      .order("created_at", { ascending: false });
    if (role) query = query.eq("role", role);
    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      query = query.or(`name.ilike.${term},email.ilike.${term}`);
    }
    const { data, error } = await query;
    if (error) throw error;
    res.status(200).json({ message: "Danh sách người dùng", users: data || [] });
  } catch (err) {
    console.error("getAllUsers error:", err);
    res.status(500).json({ error: "Lỗi khi lấy danh sách người dùng: " + err.message });
  }
};

module.exports = getAllUsers;
