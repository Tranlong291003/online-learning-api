import fs from 'fs';

// ====== CONFIG ======
const OLLAMA_HOST = 'https://ollama.com';
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY;
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gpt-oss:120b';
const PR_NUMBER = process.env.PR_NUMBER;
const PR_TITLE = process.env.PR_TITLE || '';
const PR_BODY = process.env.PR_BODY || '';
const REPO_NAME = process.env.REPO_NAME || '';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const COMMIT_SHA = process.env.COMMIT_SHA;
const PR_BASE_REF = process.env.PR_BASE_REF || 'main';
const PR_HEAD_REF = process.env.PR_HEAD_REF || '';

if (!OLLAMA_API_KEY) { console.error('❌ OLLAMA_API_KEY not set'); process.exit(1); }
if (!GITHUB_TOKEN) { console.error('❌ GITHUB_TOKEN not set'); process.exit(1); }
if (!COMMIT_SHA) { console.error('❌ COMMIT_SHA not set'); process.exit(1); }

const SYSTEM_PROMPT = `Bạn là GitHub Copilot code reviewer cho dự án Node.js/Express backend (online-learning-api). Bạn review bằng TIẾNG VIỆT, giọng đồng nghiệp nhắc nhở thân thiện.

⚠️ NGUYÊN TẮC QUAN TRỌNG NHẤT: TỰ PHÂN TÍCH TỪ DIFF
- Bạn phải TỰ ĐỌC code trong diff để hiểu mục đích thay đổi, KHÔNG được phụ thuộc vào PR title/body
- Nếu PR body trống hoặc không có, vẫn PHẢI suy ra được purpose + file purposes từ chính diff
- purpose và file.purpose KHÔNG ĐƯỢC để trống, không được viết "AI không mô tả" — nếu không suy ra được thì mô tả ngắn gọn những gì THẤY ĐƯỢC trong code

📌 ĐỊNH NGHĨA "MỤC ĐÍCH THAY ĐỔI":
Mục đích = TRẢ LỜI CÂU HỎI "thay đổi a + b này để LÀM GÌ?". Không phải mô tả chi tiết kỹ thuật, mà là:
- Giải quyết vấn đề gì?
- Phục vụ tính năng / yêu cầu nghiệp vụ nào?
- Tại sao phải thay đổi?

VÍ DỤ ĐÚNG:
❌ SAI: "Thêm SIGTERM handler, gọi server.close() rồi process.exit(0)"
✅ ĐÚNG: "Thêm graceful shutdown — để server đóng có thứ tự khi K8s restart pod, tránh request bị cắt giữa chừng và tránh connection leak"

VÍ DỤ VỀ FILE PURPOSE:
❌ SAI: "Sửa bug authentication"
✅ ĐÚNG: "Đăng nhập: thêm kiểm tra email đã verify trước khi cấp JWT, để chặn tài khoản spam đăng ký chưa xác thực"

🔍 YÊU CẦU REVIEW ẢNH HƯỞNG CHỨC NĂNG KHÁC (BẮT BUỘC):
Với MỖI comment, phải phân tích thay đổi có ảnh hưởng đến chức năng / module / route / dữ liệu nào khác không:
- Có thay đổi signature hàm, schema DB, response API, middleware order → liệt kê các chỗ bị ảnh hưởng
- Có thay đổi contract (input/output) của một hàm → nhắc các caller cần update
- Có xóa / đổi tên export → nhắc các file import chỗ đó
- Có thêm dependency mới → nhắc cần khai báo trong package.json
- Có sửa logic auth/permission → nhắc ảnh hưởng đến route nào
- Có query DB mới → nhắc ảnh hưởng đến index/performance bảng nào
- Có đổi ENV var → nhắc cần set trên production/staging

Ghi phần "Ảnh hưởng" vào CUỐI message của comment, sau dòng trống, dạng:
"\n\n**Ảnh hưởng:** <mô tả ngắn gọn các chỗ bị ảnh hưởng>"

QUY TẮC BẮT BUỘC:
1. Trả lời TIẾNG VIỆT, giọng đồng nghiệp nhắc nhở thân thiện
2. LUÔN bắt đầu response bằng chính xác marker <<<JSON>>> và kết thúc bằng <<<END>>>
3. GIỮA 2 marker là JSON object (không phải array) gồm 2 key:
   {
     "summary": {
       "purpose": "2-4 câu: trả lời 'thay đổi a+b này để LÀM GÌ' — giải quyết vấn đề gì, phục vụ tính năng nào, lý do cần thay đổi (suy ra từ code trong diff)",
       "files": [
         {"path": "src/foo.js", "changes": "+12 -5", "purpose": "1-2 câu: trả lời 'thay đổi trong file này để LÀM GÌ' (suy ra từ code trong file đó)"}
       ]
     },
     "comments": [
       {"file": "src/foo.js", "line": 12, "severity": "critical|high|medium|low", "title": "...", "message": "...", "suggestion": "code hoặc null"}
     ]
   }
4. Nếu code ổn: comments = [], summary.purpose vẫn PHẢI có nội dung
5. Line number là line trong file MỚI (sau khi áp dụng diff), phải nằm trong vùng diff
6. Comment NGẮN (1-3 câu), cuối message có dòng "**Ảnh hưởng:**" mô tả tác động
7. Code suggestion là code hoàn chỉnh có thể áp dụng luôn
8. Tối đa 8 inline comments
9. CHỈ trả về JSON trong marker, KHÔNG có text thừa trước/sau marker

CÁCH SUY RA PURPOSE TỪ DIFF (khi không có PR body):
- Đọc dòng được thêm (bắt đầu bằng +): hiểu logic mới
- Đọc dòng bị xóa (bắt đầu bằng -): hiểu logic cũ
- Đọc tên file, hàm, biến: suy ra mục đích nghiệp vụ
- Đọc import/require: biết module nào được dùng → suy ra tính năng

VÍ DỤ: file src/index.js thêm:
  + const shutdown = (signal) => { server.close(...); process.exit(0); };
  + process.on('SIGTERM', () => shutdown('SIGTERM'));
→ purpose: "Thêm graceful shutdown — để server đóng có thứ tự khi K8s restart pod, tránh request bị cắt giữa chừng và tránh connection leak"
→ file.purpose: "Thêm signal handler (SIGTERM/SIGINT) — để server tự cleanup khi nhận tín hiệu dừng, tránh treo process khi deploy"

CHECKLIST ƯU TIÊN KHI COMMENT:
🔴 CRITICAL: SQL injection, thiếu authMiddleware trên route nhạy cảm, hardcoded secret, password plain text, file upload thiếu validate, xóa nhầm route đang dùng
🟠 HIGH: null/undefined không guard, async không try-catch, memory leak (pool không close), N+1 query, race condition, đổi signature hàm mà không update caller
🟡 MEDIUM: status code sai, response format không nhất quán, thiếu pagination, validate input thiếu, thiếu index DB cho cột query
🔵 LOW: magic number, console.log còn sót, comment tiếng Việt không dấu, naming, code smell

CONTEXT DỰ ÁN:
- Stack: Node.js + Express 5
- DB: PostgreSQL (pg) + SQL Server (mssql) + Firebase Admin
- Auth: JWT
- Upload: Multer
- 13 routers: /api/{users, courses, lessons, enrollments, quizzes, questions, quiz-results, reviews, bookmarks, course-categories, mentor-requests, notifications, app-stats}

VÍ DỤ OUTPUT ĐÚNG:
<<<JSON>>>
{
  "summary": {
    "purpose": "Thêm graceful shutdown cho Express server — để server đóng có thứ tự khi nhận SIGTERM/SIGINT (ví dụ K8s restart pod), tránh request bị cắt giữa chừng và tránh connection leak từ DB pool chưa cleanup.",
    "files": [
      {"path": "src/index.js", "changes": "+14 -1", "purpose": "Thêm signal handler (SIGTERM/SIGINT) — để server tự đóng có thứ tự khi nhận tín hiệu dừng, kèm timeout 10s phòng treo process khi deploy."}
    ]
  },
  "comments": [
    {
      "file": "src/index.js",
      "line": 3,
      "severity": "high",
      "title": "Resource leak — DB pool không được đóng",
      "message": "Import pgPool nhưng không gọi pgPool.end() trong shutdown handler → connection leak khi pod bị kill. Tương tự với SQL Server pool.\\n\\n**Ảnh hưởng:** Mọi query đang dùng pgPool/mssql sẽ bị terminate đột ngột khi restart, có thể làm hỏng transaction đang dở; nên đóng pool TRƯỚC khi gọi process.exit() và SAU khi server.close() xong hết in-flight request.",
      "suggestion": "await pgPool.end();\nawait sqlPool.close();\nconsole.log('Đã đóng DB pools.');"
    }
  ]
}
<<<END>>>`;

const DIFF = fs.readFileSync('pr.diff', 'utf-8');

if (!DIFF.trim()) {
  console.log('⚠️ Empty diff, skipping.');
  process.exit(0);
}

function parseDiff(diffText) {
  const files = new Map();
  const fileBlocks = diffText.split(/^diff --git /m).slice(1);
  for (const block of fileBlocks) {
    const headerMatch = block.match(/^a\/(.+?) b\//);
    if (!headerMatch) continue;
    const filePath = headerMatch[1];
    const lines = new Set();
    let additions = 0;
    let deletions = 0;
    const hunkRegex = /@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/g;
    let hunkMatch;
    while ((hunkMatch = hunkRegex.exec(block)) !== null) {
      const start = parseInt(hunkMatch[1], 10);
      const count = hunkMatch[2] ? parseInt(hunkMatch[2], 10) : 1;
      const end = start + Math.max(count - 1, 0);
      for (let l = start; l <= end; l++) lines.add(l);
    }
    for (const line of block.split('\n')) {
      if (line.startsWith('+') && !line.startsWith('+++')) additions++;
      else if (line.startsWith('-') && !line.startsWith('---')) deletions++;
    }
    files.set(filePath, { lines, additions, deletions });
  }
  return files;
}

const VALID_FILES = parseDiff(DIFF);
const FILES_CHANGED = [...VALID_FILES.keys()].map(p => ({
  path: p,
  changes: `+${VALID_FILES.get(p).additions} -${VALID_FILES.get(p).deletions}`,
}));

const diffSnippet = DIFF.slice(0, 25000);
const DIFF_FENCE_OPEN = '```diff';
const DIFF_FENCE_CLOSE = '```';
const SUGG_FENCE = '```suggestion';
const USER_PROMPT = [
  `# PR #${PR_NUMBER}: ${PR_TITLE}`,
  '',
  PR_BODY ? `Mô tả PR:\n${PR_BODY}\n` : '',
  `So sánh: \`${PR_HEAD_REF}\` → \`${PR_BASE_REF}\``,
  `Files changed (${FILES_CHANGED.length}):`,
  FILES_CHANGED.map(f => `- ${f.path} (${f.changes})`).join('\n'),
  '',
  DIFF_FENCE_OPEN,
  diffSnippet + (DIFF.length > 25000 ? '\n... (cắt bớt)' : ''),
  DIFF_FENCE_CLOSE,
  '',
  `Hãy review và trả về JSON đúng format trong system prompt:
- summary.purpose: PR này thay đổi gì, giải quyết vấn đề gì
- summary.files: liệt kê từng file thay đổi + mục đích
- comments: inline comment (nếu có) — line phải nằm trong vùng diff ở file mới`
].join('\n');

async function callOllamaCloud() {
  const body = {
    model: OLLAMA_MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: USER_PROMPT }
    ],
    stream: false,
    options: { temperature: 0.1, num_predict: 16000, top_p: 0.9, seed: 42, keep_alive: '5m' }
  };
  console.log(`🤖 Calling ${OLLAMA_MODEL}...`);
  const response = await fetch(`${OLLAMA_HOST}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OLLAMA_API_KEY}` },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`Ollama ${response.status}: ${await response.text()}`);
  const data = await response.json();
  const content = data.message?.content || '';
  console.log(`📥 AI raw response (${content.length} chars):`);
  console.log('--- BEGIN ---');
  console.log(content);
  console.log('--- END ---');
  return content;
}

function extractFirstCompleteJSONObject(text) {
  // Tìm vị trí { đầu tiên, sau đó bracket-match để tìm } tương ứng
  const first = text.indexOf('{');
  if (first < 0) return null;

  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = first; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\') { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return text.substring(first, i + 1);
      }
    }
  }
  return null;
}

// Tìm JSON object lớn nhất (để match object ngoài cùng khi có nested objects)
function extractLargestJSONObject(text) {
  let best = null;
  const starts = [...text.matchAll(/\{/g)];
  for (const start of starts) {
    let depth = 0, inString = false, escape = false;
    for (let i = start.index; i < text.length; i++) {
      const ch = text[i];
      if (escape) { escape = false; continue; }
      if (ch === '\\') { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          const candidate = text.substring(start.index, i + 1);
          if (!best || candidate.length > best.length) best = candidate;
          break;
        }
      }
    }
  }
  return best;
}

function tryParse(text) {
  if (text.startsWith('```')) text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try { return JSON.parse(text); } catch { return null; }
}

function parseAIResponse(raw) {
  // 1) Thử tất cả cặp marker <<<JSON>>>...<<<END>>>, lấy cặp parse được và dài nhất
  const jsonStarts = [...raw.matchAll(/<<<JSON>>>/g)];
  const endMatches = [...raw.matchAll(/<<<END>>>/g)];
  let bestParsed = null;
  let bestCandidate = null;
  let lastError = null;
  if (jsonStarts.length > 0 && endMatches.length > 0) {
    for (const start of jsonStarts) {
      for (const end of endMatches) {
        if (end.index > start.index) {
          const candidate = raw.substring(start.index + 10, end.index).trim();
          try {
            const parsed = JSON.parse(candidate);
            if (parsed && (typeof parsed === 'object')) {
              if (!bestParsed || JSON.stringify(parsed).length > JSON.stringify(bestParsed).length) {
                bestParsed = parsed;
                bestCandidate = candidate;
              }
            }
          } catch (e) {
            lastError = e.message;
          }
        }
      }
    }
  }
  if (bestParsed) {
    return {
      summary: bestParsed.summary || { purpose: '', files: [] },
      comments: Array.isArray(bestParsed.comments) ? bestParsed.comments : []
    };
  }
  if (jsonStarts.length > 0) {
    console.error(`⚠️ Found ${jsonStarts.length} JSON markers but parse failed: ${lastError}`);
    console.error(`First 200 chars of first candidate: ${bestCandidate?.slice(0, 200) || 'n/a'}`);
  }

  // 2) Không có marker đầy đủ → tìm JSON object lớn nhất trong raw text
  const largest = extractLargestJSONObject(raw);
  if (largest) {
    const parsed = tryParse(largest);
    if (parsed && typeof parsed === 'object') {
      return {
        summary: parsed.summary || { purpose: '', files: [] },
        comments: Array.isArray(parsed.comments) ? parsed.comments : []
      };
    }
  }

  console.error('⚠️ No valid JSON found in response');
  return { summary: { purpose: '', files: [] }, comments: [] };
}

function isLineInDiff(file, line) {
  return VALID_FILES.get(file)?.lines?.has(line) ?? false;
}

const EMOJI = { critical: '🔴', high: '🟠', medium: '🟡', low: '🔵' };

function formatInlineComment(c) {
  const emoji = EMOJI[c.severity] || '💡';
  const title = c.title || 'Suggestion';
  const msg = c.message || '';
  let body = `${emoji} **${title}**\n\n${msg}`;
  if (c.suggestion) body += `\n\n### Suggested change\n\n${SUGG_FENCE}\n${c.suggestion}\n${DIFF_FENCE_CLOSE}`;
  return body;
}

function buildSummaryReview({ purpose, files, comments }) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  comments.forEach(c => { counts[c.severity] = (counts[c.severity] || 0) + 1; });
  const total = comments.length;

  let md = `<div align="center">\n\n`;
  md += `## 🤖 AI Code Review\n\n`;
  md += `</div>\n\n`;

  // ─── Status banner ───
  if (total === 0) {
    md += `> ✅ **Looks good to merge!** Không phát hiện vấn đề nghiêm trọng.\n\n`;
  } else if (counts.critical > 0) {
    md += `> ⛔ **Có ${counts.critical} vấn đề nghiêm trọng cần sửa trước khi merge.**\n\n`;
  } else if (counts.high > 0) {
    md += `> ⚠️ **Có ${counts.high} vấn đề quan trọng nên xem xét trước khi merge.**\n\n`;
  } else {
    md += `> 💡 **Có một vài góp ý nhỏ, có thể xem xét hoặc bỏ qua.**\n\n`;
  }

  // ─── Severity badges ───
  md += `### 📊 Tổng quan (${total} comment)\n\n`;
  if (total === 0) {
    md += `_Không có comment nào._\n\n`;
  } else {
    md += `| Mức độ | Số lượng |\n| :--- | :---: |\n`;
    if (counts.critical) md += `| 🔴 Critical | ${counts.critical} |\n`;
    if (counts.high) md += `| 🟠 High | ${counts.high} |\n`;
    if (counts.medium) md += `| 🟡 Medium | ${counts.medium} |\n`;
    if (counts.low) md += `| 🔵 Low (nit) | ${counts.low} |\n`;
    md += `| **Tổng** | **${total}** |\n\n`;
  }

  // ─── Mục đích thay đổi ───
  md += `### 🎯 Mục đích thay đổi\n\n`;
  md += purpose
    ? `> ${purpose.replace(/\n/g, '\n> ')}\n\n`
    : `> _AI chưa phân tích được mục đích từ diff._\n\n`;

  // ─── Files changed ───
  md += `### 📂 Files changed (${files?.length || 0})\n\n`;
  if (files && files.length > 0) {
    md += `| File | Mục đích |\n| :--- | :--- |\n`;
    for (const f of files) {
      const p = f.purpose || '_—_';
      md += `| \`${f.path}\` | ${p.replace(/\|/g, '\\|').replace(/\n/g, ' ')} |\n`;
    }
    md += `\n`;
  } else {
    md += `_Không có file nào thay đổi._\n\n`;
  }

  // ─── Footer ───
  if (total > 0) md += `👉 **Xem chi tiết ở các inline comment bên dưới.**\n\n`;
  md += `<sub>🤖 Powered by Ollama Cloud · \`${OLLAMA_MODEL}\` · PR #${PR_NUMBER} · \`${PR_HEAD_REF}\` → \`${PR_BASE_REF}\`</sub>`;
  return md;
}

async function postReview(body, inlineComments) {
  const url = `https://api.github.com/repos/${REPO_NAME}/pulls/${PR_NUMBER}/reviews`;
  const payload = {
    commit_id: COMMIT_SHA,
    body,
    event: 'COMMENT',
    comments: inlineComments.map(c => ({ path: c.path, line: c.line, side: 'RIGHT', body: c.body }))
  };
  console.log(`📤 Posting review: ${inlineComments.length} inline comments...`);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'ai-review-bot'
    },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  console.log(`✅ Review posted: ${data.html_url}`);
}

async function main() {
  try {
    const raw = await callOllamaCloud();
    const { summary, comments: aiComments } = parseAIResponse(raw);
    console.log(`📋 AI returned ${aiComments.length} comments`);

    const validComments = aiComments.filter(c => {
      if (!c.file || !c.line || !c.severity) return false;
      if (!VALID_FILES.has(c.file)) { console.log(`  ⚠️ Skip (file not in diff): ${c.file}`); return false; }
      const lineNum = parseInt(c.line, 10);
      if (!isLineInDiff(c.file, lineNum)) { console.log(`  ⚠️ Skip (line not in diff): ${c.file}:${c.line}`); return false; }
      return true;
    });
    console.log(`✓ ${validComments.length}/${aiComments.length} valid`);

    // Nếu AI không trả file list → tự build từ diff (chỉ tên file, không giả mạo purpose)
    const filesForSummary = summary.files && summary.files.length > 0
      ? summary.files
      : FILES_CHANGED.map(f => ({ path: f.path, changes: f.changes, purpose: '_AI chưa phân tích file này_' }));

    const inlineComments = validComments.map(c => ({
      path: c.file,
      line: parseInt(c.line, 10),
      body: formatInlineComment(c)
    }));

    const reviewBody = buildSummaryReview({ purpose: summary.purpose, files: filesForSummary, comments: validComments });
    await postReview(reviewBody, inlineComments);
    console.log(`🎉 Done!`);
  } catch (err) {
    console.error('❌ Failed:', err.message);
    process.exit(1);
  }
}

main();
