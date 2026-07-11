// controllers/users/loginUser.js
// Dang nhap bang email/password qua Supabase Auth.
const { supabaseAdmin } = require("../../services/supabase.service");

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Thieu email hoac password" });
    }

    const { data, error } = await supabaseAdmin.auth.signInWithPassword({ email, password });
    if (error || !data || !data.user) {
      return res.status(401).json({ error: "Sai email hoac password" });
    }

    res.status(200).json({
      message: "Dang nhap thanh cong",
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      user: { uid: data.user.id, email: data.user.email },
    });
  } catch (err) {
    console.error("loginUser error:", err);
    res.status(500).json({ error: "Loi server: " + err.message });
  }
};

module.exports = loginUser;
