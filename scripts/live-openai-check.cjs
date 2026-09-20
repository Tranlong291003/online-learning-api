require("dotenv").config();
const { OpenAI } = require("openai");
(async () => {
  if (!process.env.OPENAI_API_KEY) return console.log("❌ chưa có OPENAI_API_KEY");
  const o = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 0, timeout: 15000 });
  try {
    const r = await o.chat.completions.create({ model: "gpt-3.5-turbo", messages: [{ role: "user", content: "say OK" }], max_tokens: 5 });
    console.log("✅ OpenAI OK:", r.choices[0].message.content.trim());
  } catch (e) {
    console.log("❌ OpenAI:", e.status || "", e.message.split("\n")[0]);
  }
})();
