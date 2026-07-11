// controllers/mentorRequest.controller.js
// Mentor request: user gui yeu cau, admin duyet.
const { insertRows, updateRows, supabaseAdmin } = require("../services/supabase.service");

// User gui yeu cau (can auth)
const createRequest = async (req, res) => {
  try {
    const user_uid = req.supabaseUser.authUser.id;
    const { reason, image_url } = req.body;
    if (!image_url || !String(image_url).trim())
      return res.status(400).json({ error: "Vui long cung cap anh minh chung (image_url)" });

    // Kiem tra co request pending khong
    const { data: pending } = await supabaseAdmin
      .from("upgrade_requests")
      .select("id")
      .eq("user_uid", user_uid)
      .eq("status", "pending")
      .limit(1);
    if (pending && pending.length)
      return res.status(400).json({ error: "Ban da gui yeu cau va dang cho duyet" });

    const { data, error } = await insertRows(supabaseAdmin, "upgrade_requests", {
      user_uid,
      status: "pending",
      reason: reason || null,
      image_url: String(image_url).trim(),
    });
    if (error) throw error;
    res.status(201).json({ message: "Yeu cau da duoc gui", data: data && data[0] ? data[0] : null });
  } catch (err) {
    console.error("mentorRequest.create error:", err);
    res.status(500).json({ error: err.message });
  }
};

// Admin: lay danh sach request
const getRequests = async (req, res) => {
  try {
    const { status } = req.query;
    let query = supabaseAdmin
      .from("upgrade_requests")
      .select("id, user_uid, status, reason, image_url, created_at, updated_at")
      .order("created_at", { ascending: false });
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) throw error;
    res.status(200).json({ data: data || [] });
  } catch (err) {
    console.error("mentorRequest.list error:", err);
    res.status(500).json({ error: err.message });
  }
};

// Admin: duyet / tu choi
const updateStatusRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;
    if (!["approved", "rejected"].includes(status))
      return res.status(400).json({ error: "Trang thai khong hop le" });

    const { data: reqRow } = await supabaseAdmin
      .from("upgrade_requests")
      .select("user_uid")
      .eq("id", Number(id))
      .maybeSingle();
    if (!reqRow) return res.status(404).json({ error: "Khong tim thay yeu cau" });

    const { error: upErr } = await updateRows(
      supabaseAdmin,
      "upgrade_requests",
      {
        status,
        reason: status === "rejected" ? reason || null : null,
        updated_at: new Date().toISOString(),
      },
      { id: Number(id) }
    );
    if (upErr) throw upErr;

    // Neu duyet -> doi role user thanh mentor
    if (status === "approved") {
      await updateRows(
        supabaseAdmin,
        "users",
        { role: "mentor", updated_at: new Date().toISOString() },
        { uid: reqRow.user_uid }
      );
    }

    // Tao notification
    await insertRows(supabaseAdmin, "notifications", {
      uid: reqRow.user_uid,
      title: status === "approved" ? "Yeu cau Mentor duoc duyet" : "Yeu cau Mentor bi tu choi",
      content:
        status === "approved"
          ? "Chuc mung! Ban da tro thanh Mentor."
          : `Yeu cau nang cap Mentor cua ban da bi tu choi. Ly do: ${reason || "Khong co"}`,
      icon: "mentor",
      color: status === "approved" ? "#4caf50" : "#f44336",
    });

    res.status(200).json({ message: `Yeu cau da duoc ${status === "approved" ? "duyet" : "tu choi"}` });
  } catch (err) {
    console.error("mentorRequest.update error:", err);
    res.status(500).json({ error: err.message });
  }
};

module.exports = { createRequest, getRequests, updateStatusRequest };
