// controllers/users/createUser.js
// Tao user moi (signup). Tao auth user bang Supabase Auth admin API,
// roi insert row vao public.users.
const { supabaseAdmin } = require("../../services/supabase.service");

const createUser = async (req, res) => {
  try {
    const { email, password, name, role } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: "Thieu email, password hoac name" });
    }

    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (authErr) {
      return res.status(400).json({ error: "Tao auth user that bai: " + authErr.message });
    }
    const uid = authData.user.id;

    const allowedRoles = ["user", "mentor", "admin"];
    const finalRole = allowedRoles.includes(role) ? role : "user";

    const { data, error } = await supabaseAdmin
      .from("users")
      .insert({
        uid,
        email,
        name,
        role: finalRole,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      // rollback auth user neu insert that bai
      await supabaseAdmin.auth.admin.deleteUser(uid).catch(() => {});
      return res.status(400).json({ error: "Tao profile that bai: " + error.message });
    }

    res.status(201).json({ message: "Tao user thanh cong", user: data });
  } catch (err) {
    console.error("createUser error:", err);
    res.status(500).json({ error: "Loi server: " + err.message });
  }
};

module.exports = createUser;
