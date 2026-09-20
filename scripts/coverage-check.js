const fs = require("fs");
const path = require("path");

const repoRoot = path.join(__dirname, "..");
const testDir = path.join(repoRoot, "test", "api");

function loadSpec() {
  process.env.NODE_ENV = "test";
  const { buildSpec } = require(path.join(repoRoot, "src", "config", "swagger.config.js"));
  const spec = buildSpec();
  const endpoints = new Set();
  for (const [p, methods] of Object.entries(spec.paths)) {
    for (const m of Object.keys(methods)) {
      endpoints.add(`${m.toUpperCase()} ${p}`);
    }
  }
  return endpoints;
}

function normalize(url) {
  return url.replace(/:([A-Za-z0-9_]+)/g, "{$1}").replace(/\/+/g, "/");
}

function extractTests() {
  const found = new Set();
  const byFile = new Map();
  const files = fs.readdirSync(testDir).filter((f) => f.endsWith(".test.js"));
  for (const f of files) {
    const content = fs.readFileSync(path.join(testDir, f), "utf8");
    const fileHits = new Set();
    // Nhận cả template literal (`` ` ``) chứ không chỉ nháy kép, nếu không
    // những test viết `json(\`/api/notifications/update/${id}\`)` bị coi là
    // chưa có test dù thực tế đã được kiểm tra.
    const re = /(?:await\s+)?(?:request|json)\(\s*[`"]([^`"]+)[`"]/g;
    let m;
    while ((m = re.exec(content))) {
      const url = m[1];
      const window = content.slice(m.index, m.index + 400);
      const methodMatch = window.match(/method\s*:\s*"(\w+)"/);
      const method = methodMatch ? methodMatch[1].toUpperCase() : "GET";
      found.add(`${method} ${normalize(url)}`);
      fileHits.add(`${method} ${normalize(url)}`);
    }
    byFile.set(f, fileHits);
  }
  return { found, byFile, files };
}

const spec = loadSpec();
const { found, byFile, files } = extractTests();

// Build per-endpoint regexes from templates: GET /api/courses/{course_id} -> ^GET /api/courses/[^/]+/?$
const specRegex = [];
for (const ep of spec) {
  const [method, p] = ep.split(" ");
  const parts = p
    .replace(/\/+/g, "/")
    .replace(/\/$/, "")
    .split("/")
    .map((seg) =>
      seg.startsWith("{") ? "[^/]+" : seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    );
  specRegex.push({ ep, re: new RegExp(`^${method} ${parts.join("/")}/?$`, "i") });
}

function hitFor(ep) {
  const entry = specRegex.find((s) => s.ep === ep);
  for (const f of files) {
    for (const concrete of byFile.get(f)) {
      if (entry && entry.re.test(concrete)) return true;
    }
  }
  return false;
}

const specArr = [...spec].sort();
console.log("=== ENDPOINTS NEVER HIT BY ANY TEST ===");
let missing = 0;
for (const ep of specArr) {
  if (!hitFor(ep)) {
    console.log("  " + ep);
    missing++;
  }
}
console.log(`\nTotal endpoints in spec: ${specArr.length}`);
console.log(`Endpoints never hit by tests: ${missing}`);
console.log(`Unique concrete (method,path) pairs hit by tests: ${found.size}`);

console.log("\n=== ENDPOINT -> TEST FILES ===");
for (const ep of specArr) {
  const entry = specRegex.find((s) => s.ep === ep);
  const hitters = files.filter((f) =>
    [...byFile.get(f)].some((c) => entry && entry.re.test(c))
  );
  console.log(`  ${ep} -> ${hitters.join(", ") || "NONE"}`);
}

