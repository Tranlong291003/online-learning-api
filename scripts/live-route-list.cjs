/** Liệt kê MỌI route đã mount, đọc trực tiếp từ router (bắt cả route viết nhiều dòng). */
require("dotenv").config();
const fs = require("fs");
const path = require("path");

const appJs = fs.readFileSync(path.join(__dirname, "..", "src", "app.js"), "utf8");
const mounts = [...appJs.matchAll(/app\.use\(\s*"([^"]+)"\s*,\s*(\w+)\s*\)/g)]
  .map((m) => ({ mountPath: m[1], varName: m[2] }));

const requireLines = [...appJs.matchAll(/const\s+(\w+)\s*=\s*require\("\.\/(routes\/[\w.]+)"\)/g)]
  .reduce((acc, m) => ((acc[m[1]] = m[2]), acc), {});

let total = 0;
for (const { mountPath, varName } of mounts) {
  const rel = requireLines[varName];
  if (!rel) continue;
  const router = require(path.join(__dirname, "..", "src", rel));
  console.log("\n### " + mountPath);
  for (const layer of router.stack) {
    if (!layer.route) continue;
    const methods = Object.keys(layer.route.methods).filter((m) => m !== "all");
    for (const m of methods) {
      console.log("  " + m.toUpperCase().padEnd(7) + (mountPath + layer.route.path));
      total++;
    }
  }
}
console.log("\n== TỔNG: " + total + " route ==");
