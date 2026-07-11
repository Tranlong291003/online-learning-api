// scripts/write-js.js
// Doc noi dung tu stdin (raw, khong qua shell escape) roi ghi ra file UTF-8.
// Dung de ghi file JS co tieng Viet co dau + backtick/template literal.
// Usage:
//   $content = Get-Content path\to\source.js -Raw -Encoding UTF8
//   $content | node scripts/write-js.js relative\output.js
const fs = require("fs");
const path = require("path");

const target = process.argv[2];
if (!target) {
  console.error("Usage: pipe content | node scripts/write-js.js <path>");
  process.exit(1);
}

let content = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (c) => (content += c));
process.stdin.on("end", () => {
  const abs = path.resolve(target);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, "utf8");
  console.log("Wrote:", abs, "(", Buffer.byteLength(content, "utf8"), "bytes )");
});
