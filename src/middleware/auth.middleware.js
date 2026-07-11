// =============================================================
// Auth middleware — dùng Supabase JWT
// =============================================================
// Đọc Bearer token từ header, verify với Supabase auth.getUser(),
// gắn thông tin user vào req.user + req.supabaseUser.
// =============================================================
const { supabaseAdmin } = require("../config/supabase.config");

module.exports = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ error: "Thiếu hoặc sai định dạng Authorization header" });
  }
  const accessToken = authHeader.split(" ")[1];

  try {
    const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
    if (error || !data || !data.user) {
      return res
        .status(401)
        .json({ error: "Token không hợp lệ hoặc đã hết hạn" });
    }

    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("users")
      .select("id, uid, name, role, is_active, avatar_url")
      .eq("uid", data.user.id)
      .maybeSingle();

    if (profileErr) {
      return res
        .status(500)
        .json({ error: "Không lấy được profile: " + profileErr.message });
    }
    if (!profile) {
      return res
        .status(401)
        .json({ error: "User chưa có profile trong hệ thống" });
    }
    if (profile.is_active === false) {
      return res.status(403).json({ error: "Tài khoản đã bị vô hiệu hoá" });
    }

    req.user = profile;
    req.supabaseUser = { accessToken, authUser: data.user };
    next();
  } catch (err) {
    console.error("[authMiddleware] error:", err);
    res
      .status(500)
      .json({ error: "Lỗi xác thực: " + (err.message || "unknown") });
  }
};

module.exports.requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Chưa xác thực" });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ error: `Cần role: ${allowedRoles.join(" hoặc ")}` });
    }
    next();
  };
};