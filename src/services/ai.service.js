// services/ai.service.js
// Wrapper goi truc tiep Ollama Cloud (https://ollama.com) de sinh cau hoi quiz.
// KHONG dung qua 9router - goi thang web Ollama.
//
// Env (set trong .env neu muon override):
//   OLLAMA_URL    (mac dinh: https://ollama.com)
//   OLLAMA_KEY    API key cua Ollama Cloud (bat buoc neu dung cloud)
//   OLLAMA_MODEL  (mac dinh: minimax-m3)
const https = require("https");
const { URL } = require("url");

const OLLAMA_URL = process.env.OLLAMA_URL || "https://ollama.com";
const OLLAMA_KEY = process.env.OLLAMA_KEY || "";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "minimax-m3";

function callOllama(messages) {
  return new Promise((resolve, reject) => {
    // Ollama Cloud exposes /v1/chat/completions (OpenAI-compatible)
    const base = new URL(OLLAMA_URL);
    const path = base.pathname && base.pathname !== "/"
      ? `${base.pathname.replace(/\/$/, "")}/chat/completions`
      : "/v1/chat/completions";
    const body = JSON.stringify({
      model: OLLAMA_MODEL,
      messages,
      temperature: 0.3,
      stream: false,
      response_format: { type: "json_object" },
    });
    const opts = {
      method: "POST",
      hostname: base.hostname,
      port: base.port || (base.protocol === "https:" ? 443 : 80),
      path,
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        ...(OLLAMA_KEY ? { Authorization: `Bearer ${OLLAMA_KEY}` } : {}),
      },
    };
    const req = https.request(opts, (res) => {
      let chunks = "";
      res.on("data", (d) => (chunks += d));
      res.on("end", () => {
        try {
          if (res.statusCode >= 400) {
            return reject(new Error(`Ollama HTTP ${res.statusCode}: ${chunks.slice(0, 300)}`));
          }
          const json = JSON.parse(chunks);
          const content =
            json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content;
          if (!content) return reject(new Error("AI response rong: " + chunks.slice(0, 300)));
          resolve(content);
        } catch (e) {
          reject(new Error("Parse AI response failed: " + e.message + " | raw: " + chunks.slice(0, 300)));
        }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

const SAFE_FALLBACK = (type) => ({
  question: "Câu hỏi mặc định do AI tạo (fallback). Vui lòng chỉnh sửa.",
  options: type === "trac_nghiem" ? ["Lựa chọn A", "Lựa chọn B", "Lựa chọn C", "Lựa chọn D"] : null,
  correct_index: type === "trac_nghiem" ? 0 : null,
});

async function generateAiQuiz(prompt, type = "trac_nghiem") {
  const systemMsg =
    type === "trac_nghiem"
      ? 'Ban la AI tao cau hoi trac nghiem. Tra ve JSON: {"question": string, "options": [4 strings], "correct_index": int 0-3}. Chi tra JSON thuan.'
      : 'Ban la AI tao cau hoi tu luan. Tra ve JSON: {"question": string, "expected_keywords": "tu khoa1, tu khoa2"}. Chi tra JSON thuan.';

  try {
    const content = await callOllama([
      { role: "system", content: systemMsg },
      { role: "user", content: prompt },
    ]);
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      const m = content.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : null;
    }
    if (!parsed) return SAFE_FALLBACK(type);
    return parsed;
  } catch (e) {
    console.warn("[ai.service] generateAiQuiz failed:", e.message);
    return SAFE_FALLBACK(type);
  }
}

module.exports = { generateAiQuiz, OLLAMA_MODEL, OLLAMA_URL };
