// =============================================================
// Supabase client configuration
// =============================================================
// Supabase cung cấp 2 client:
//   - supabaseAdmin: dùng service_role key, BYPASS RLS - chỉ dùng ở backend
//   - supabaseClient: dùng anon key, tuân thủ RLS - dùng cho user-level queries
//
// Lưu ý bảo mật: service_role key KHÔNG BAO GIỜ được gửi về client.
//
// Node 20 thiếu global WebSocket -> Supabase realtime crash. Polyfill bang `ws`
// truoc khi tao client de cac query REST van hoat dong binh thuong.
// =============================================================
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

if (typeof globalThis.WebSocket === "undefined") {
  try {
    // eslint-disable-next-line global-require
    globalThis.WebSocket = require("ws");
  } catch (e) {
    console.warn(
      "[supabase] Khong tim thay package 'ws' de polyfill WebSocket. " +
        "Cai dat: npm i ws"
    );
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  // Không throw ngay để test không cần DB vẫn pass;
  // chỉ cảnh báo. Service sẽ fail khi gọi query nếu thiếu.
  console.warn(
    "[supabase] Thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_KEY trong .env"
  );
}

// Admin client: bypass RLS, dùng cho mọi thao tác backend (CRUD user, admin...).
const supabaseAdmin = createClient(SUPABASE_URL || "http://localhost", SUPABASE_SERVICE_KEY || "dummy-service-key", {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// User-scoped client: dùng JWT của user để truy vấn, tôn trọng RLS.
// Tạo mới mỗi request thông qua helper bên dưới.
function createUserClient(accessToken) {
  return createClient(SUPABASE_URL || "http://localhost", SUPABASE_ANON_KEY || "dummy-anon-key", {
    global: {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

module.exports = {
  supabaseAdmin,
  createUserClient,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
};
