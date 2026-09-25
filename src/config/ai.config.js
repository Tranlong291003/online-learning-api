/**
 * Cấu hình dịch vụ AI (sinh câu hỏi, sinh lời giải).
 *
 * Trước đây mã gọi thẳng OpenAI với `model: "gpt-3.5-turbo"` viết cứng trong
 * từng controller, và chỉ đọc `OPENAI_API_KEY`. Muốn đổi sang nhà cung cấp khác
 * phải sửa nhiều nơi, và tên model cũng nằm rải rác.
 *
 * Ở đây gom về một chỗ. Dịch vụ AI hiện dùng là 9router — một cổng tương thích
 * API OpenAI, chạy trên máy nội bộ, nên chỉ cần đổi `baseURL` và tên model là
 * xong; phần còn lại của SDK giữ nguyên.
 *
 * Biến môi trường:
 *   AI_BASE_URL    Gốc API, ví dụ http://localhost:20128/v1  (bắt buộc)
 *   AI_API_KEY     Khoá truy cập                                (bắt buộc)
 *   AI_MODEL       Tên model, ví dụ ag/gemini-3.8-flash         (bắt buộc)
 *
 * Không có giá trị mặc định cho model: mỗi cổng đặt tên model một khác, đoán sai
 * sẽ hỏng lúc chạy chứ không hỏng lúc khởi động. Thiếu cấu hình thì endpoint AI
 * trả 503 kèm hướng dẫn, còn phần còn lại của API vẫn hoạt động bình thường.
 */
const { OpenAI } = require("openai");

const AI_BASE_URL = (process.env.AI_BASE_URL || "").trim();
const AI_API_KEY = (process.env.AI_API_KEY || "").trim();
const AI_MODEL = (process.env.AI_MODEL || "").trim();

/** Tên biến môi trường còn thiếu, dùng để báo lỗi chỉ đúng chỗ cần điền. */
function missingConfig() {
  const missing = [];
  if (!AI_BASE_URL) missing.push("AI_BASE_URL");
  if (!AI_API_KEY) missing.push("AI_API_KEY");
  if (!AI_MODEL) missing.push("AI_MODEL");
  return missing;
}

/** Cấu hình đã đủ để gọi dịch vụ AI chưa. */
function isAiConfigured() {
  return missingConfig().length === 0;
}

/**
 * Câu thông báo khi chưa cấu hình, nêu rõ biến còn thiếu.
 * Endpoint AI là tính năng phụ; thiếu cấu hình không được làm hỏng phần còn lại.
 */
function notConfiguredMessage() {
  return (
    "Dịch vụ AI chưa được cấu hình (thiếu " +
    missingConfig().join(", ") +
    "). Đặt các biến này trong .env rồi khởi động lại API. " +
    "Trong lúc chờ, dùng chức năng tạo câu hỏi thủ công."
  );
}

/**
 * Tạo client AI, hoặc null nếu chưa cấu hình đủ.
 *
 * @param {{timeout?: number, maxRetries?: number}} [options]
 */
function getAiClient(options = {}) {
  if (!isAiConfigured()) return null;

  return new OpenAI({
    apiKey: AI_API_KEY,
    baseURL: AI_BASE_URL,
    ...options,
  });
}

/**
 * Gọi AI và trả về nội dung văn bản.
 *
 * `stream: false` phải gửi TƯỜNG MINH: cổng 9router mặc định trả về dạng
 * streaming (các dòng `data: {...}` của SSE) dù client không yêu cầu, và SDK
 * OpenAI đọc luồng đó như một phản hồi thường nên `choices[0].message.content`
 * ra rỗng. Đặt rõ `stream: false` thì cổng trả về JSON một lần như mong đợi.
 *
 * @param {object} params
 * @param {string} params.prompt Nội dung yêu cầu.
 * @param {number} [params.temperature]
 * @param {number} [params.maxTokens]
 * @param {number} [params.timeout] Thời gian chờ, mili giây.
 * @param {AbortSignal} [params.signal]
 * @returns {Promise<string|null>} Nội dung trả về, hoặc null nếu chưa cấu hình.
 */
async function askAi({ prompt, temperature = 0.7, maxTokens = 700, timeout, signal }) {
  const client = getAiClient(timeout ? { timeout, maxRetries: 0 } : {});
  if (!client) return null;

  const response = await client.chat.completions.create(
    {
      model: AI_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature,
      max_tokens: maxTokens,
      stream: false,
    },
    signal ? { signal } : undefined
  );

  return response.choices?.[0]?.message?.content ?? "";
}

module.exports = {
  AI_BASE_URL,
  AI_MODEL,
  getAiClient,
  askAi,
  isAiConfigured,
  missingConfig,
  notConfiguredMessage,
};
