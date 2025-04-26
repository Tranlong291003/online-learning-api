// controllers/user/updateUser.js
const path = require("path");
const { sql, poolPromise } = require("../../config/db.config");

/**
 * PUT /api/users/:id
 * middleware multer.single('avatar') phải chạy trước
 */
const updateUser = async (req, res) => {
  const uid = req.params.id;
  const { name, bio, phone } = req.body;

  /* ---------- Chuẩn bị avatar_url (nếu có) ---------- */
  let avatarUrl = null;
  if (req.file) {
    avatarUrl = `/uploads/avatars/${path.basename(req.file.path)}`;
  }

  /* ---------- Xây mảng SET động ---------- */
  const setClauses = [];
  const inputs = []; // gom input để thêm vào request sau

  if (name !== undefined) {
    setClauses.push("name   = @name");
    inputs.push(["name", name]);
  }
  if (bio !== undefined) {
    setClauses.push("bio    = @bio");
    inputs.push(["bio", bio]);
  }
  if (phone !== undefined) {
    setClauses.push("phone  = @phone");
    inputs.push(["phone", phone]);
  }
  if (avatarUrl) {
    setClauses.push("avatar_url = @avatar_url");
    inputs.push(["avatar_url", avatarUrl]);
  }

  // chẳng có gì để update
  if (setClauses.length === 0) {
    return res.status(400).json({ error: "Không có dữ liệu để cập nhật" });
  }

  // luôn cập nhật updated_at
  setClauses.push("updated_at = GETDATE()");

  try {
    const pool = await poolPromise;
    const request = pool.request().input("uid", sql.NVarChar, uid);

    // thêm các input động
    for (const [key, val] of inputs) {
      request.input(key, sql.NVarChar, val);
    }

    /* ---------- UPDATE ---------- */
    const result = await request.query(`
      UPDATE users
      SET ${setClauses.join(", ")}
      WHERE uid = @uid
    `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: "Không tìm thấy người dùng" });
    }

    /* ---------- SELECT lại user ---------- */
    const { recordset } = await pool
      .request()
      .input("uid", sql.NVarChar, uid)
      .query("SELECT * FROM users WHERE uid = @uid");

    res.json({ data: recordset[0] });
  } catch (err) {
    console.error("updateUser error:", err);
    res.status(500).json({ error: "Lỗi máy chủ: " + err.message });
  }
};

module.exports = updateUser;
