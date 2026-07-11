// Test kết nối Supabase — chạy 1 lần để xác nhận URL + keys OK
require("dotenv").config();
// Supabase realtime cần WebSocket — Node v20 không có native, dùng 'ws' làm polyfill
const WebSocket = require("ws");
globalThis.WebSocket = WebSocket;

const { createClient } = require("@supabase/supabase-js");

const url = process.env.SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_KEY;
const anon = process.env.SUPABASE_ANON_KEY;

console.log("URL:", url);
console.log("SERVICE_KEY length:", service ? service.length : "MISSING");
console.log("ANON_KEY length:", anon ? anon.length : "MISSING");

if (!url || !service || !anon) {
  console.error("❌ Thiếu biến môi trường");
  process.exit(1);
}

const supabase = createClient(url, service, {
  auth: { persistSession: false },
  global: { WebSocket },
});

(async () => {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("count", { count: "exact", head: true });
    if (error) {
      console.error("❌ Query error:", error.message);
      process.exit(1);
    }
    console.log("✅ Connected. Verifying tables...");
    const expected = [
      "users", "course_categories", "courses", "enrollments", "lessons",
      "lesson_progress", "quizzes", "quiz_questions", "quiz_results",
      "course_reviews", "bookmarks", "notifications", "upgrade_requests",
    ];
    const found = [];
    const missing = [];
    for (const t of expected) {
      const { error } = await supabase.from(t).select("count", { count: "exact", head: true });
      if (error && /schema cache|not found/i.test(error.message)) {
        missing.push(t);
      } else {
        found.push(t);
      }
    }
    console.log(`Found ${found.length}/${expected.length} tables`);
    if (missing.length) console.log("❌ Missing:", missing);
    else console.log("✅ All tables present");
  } catch (e) {
    console.error("❌ Exception:", e.message);
    process.exit(1);
  }
})();
