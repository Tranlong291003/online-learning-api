// controllers/users/getUserById.js
// :id co the la uid (text) hoac id (bigserial int). Tu dong nhan biet.
const { selectRows, supabaseAdmin } = require("../../services/supabase.service");

const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: "Thiếu tham số id" });

    let result;
    if (/^\d+$/.test(id)) {
      result = await supabaseAdmin.from("users").select("*").eq("id", Number(id)).maybeSingle();
    } else {
      result = await supabaseAdmin.from("users").select("*").eq("uid", id).maybeSingle();
    }
    if (result.error) throw result.error;
    if (!result.data) return res.status(404).json({ error: "Không tìm thấy người dùng" });

    res.status(200).json({ message: "Chi tiết người dùng", user: result.data });
  } catch (err) {
    console.error("getUserById error:", err);
    res.status(500).json({ error: "Lỗi khi lấy chi tiết người dùng: " + err.message });
  }
};

module.exports = getUserById;
