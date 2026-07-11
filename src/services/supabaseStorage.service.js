// =============================================================
// Supabase Storage wrapper
// =============================================================
// Upload / remove / getPublicUrl qua Supabase Storage.
// Thay the cho multer + local filesystem (public/uploads).
// =============================================================
const { supabaseAdmin } = require("../config/supabase.config");

/**
 * Upload buffer len Supabase Storage.
 * @param {string} bucket - ten bucket (vd: "uploads")
 * @param {string} key - duong dan trong bucket (vd: "categories/abc.png")
 * @param {Buffer} buffer - file content
 * @param {string} contentType - MIME type
 * @returns {Promise<string>} public URL cua file
 */
async function uploadBuffer(bucket, key, buffer, contentType) {
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(key, buffer, {
      contentType,
      upsert: true,
    });
  if (error) throw error;
  const { data: pub } = supabaseAdmin.storage.from(bucket).getPublicUrl(key);
  return pub.publicUrl;
}

/**
 * Xoa 1 object trong bucket.
 */
async function removeObject(bucket, keyOrUrl) {
  // Neu truyen URL, trich key tu URL
  let key = keyOrUrl;
  try {
    const u = new URL(keyOrUrl);
    const parts = u.pathname.split(`/object/public/${bucket}/`);
    if (parts[1]) key = parts[1];
  } catch (_) {
    // khong phai URL, giu nguyen key
  }
  const { error } = await supabaseAdmin.storage.from(bucket).remove([key]);
  if (error) throw error;
  return true;
}

/**
 * Lay public URL tu key.
 */
function getPublicUrl(bucket, key) {
  const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(key);
  return data.publicUrl;
}

module.exports = { uploadBuffer, removeObject, getPublicUrl };
