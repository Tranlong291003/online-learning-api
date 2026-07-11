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

const SYSTEM_PROMPT = `Bạn là GitHub Copilot code reviewer cho project Node.js/Express backend (online-learning-api).

⚠️ NGUYÊN TẮC QUAN TRỌNG NHẤT: TỰ PHÂN TÍCH TỪ DIFF
- Bạn phải TỰ ĐỌC code trong diff để hiểu mục đích thay đổi, KHÔNG phụ thuộc vào PR title/body
- Nếu PR body trống hoặc không có, vẫn PHẢI suy ra được purpose + file purposes từ chính diff
- purpose và file.purpose KHÔNG ĐƯỢC để trống, không được viết "AI không mô tả" — nếu không suy ra được thì mô tả ngắn gọn những gì THẤY ĐƯỢC trong code

QUY TẮC BẮT BUỘC:
1. Trả lời TIẾNG VIỆT, giọng đồng nghiệp nhắc nhở thân thiện
2. LUÔN bắt đầu response bằng chính xác marker <<<JSON>>> và kết thúc bằng <<<END>>>
3. GIỮA 2 marker là JSON object (không phải array) gồm 2 key:
   {
     "summary": {
       "purpose": "2-3 câu: PR này thay đổi gì, giải quyết vấn đề gì, lý do cần thay đổi (suy ra từ code trong diff)",
       "files": [
         {"path": "src/foo.js", "changes": "+12 -5", "purpose": "1 câu: thay đổi cụ thể + mục đích (suy ra từ code trong file đó)"}
       ]
     },
     "comments": [
       {"file": "src/foo.js", "line": 12, "severity": "critical|high|medium|low", "title": "...", "message": "...", "suggestion": "code hoặc null"}
     ]
   }
4. Nếu code ổn: comments = [], summary.purpose vẫn PHẢI có nội dung
5. Line number là line trong file MỚI (sau khi áp dụng diff), phải nằm trong vùng diff
6. Comment NGẮN (1-3 câu), code suggestion là code hoàn chỉnh có thể áp dụng luôn
7. Tối đa 8 inline comments
8. CHỈ trả về JSON trong marker, KHÔNG có text thừa trước/sau marker

CÁCH SUY RA PURPOSE TỪ DIFF (khi không có PR body):
- Đọc dòng được thêm (bắt đầu bằng +): hiểu logic mới
- Đọc dòng bị xóa (bắt đầu bằng -): hiểu logic cũ
- Đọc tên file, hàm, biến: suy ra mục đích nghiệp vụ
- Đọc import/require: biết module nào được dùng → suy ra tính năng

VÍ DỤ: file src/index.js thêm:
  + const shutdown = (signal) => { server.close(...); process.exit(0); };
  + process.on('SIGTERM', () => shutdown('SIGTERM'));
→ purpose: "Thêm graceful shutdown — đóng HTTP server khi nhận SIGTERM/SIGINT, tránh connection leak"

CHECKLIST ƯU TIÊN KHI COMMENT:
🔴 CRITICAL: SQL injection, thiếu authMiddleware trên route nhạy cảm, hardcoded secret, password plain text, file upload thiếu validate
🟠 HIGH: null/undefined không guard, async không try-catch, memory leak (pool không close), N+1 query, race condition
🟡 MEDIUM: status code sai, response format không nhất quán, thiếu pagination, validate input thiếu
🔵 LOW: magic number, console.log còn sót, comment tiếng Việt không dấu, naming

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
    "purpose": "Thêm graceful shutdown cho Express server — đóng HTTP server, cleanup DB pool (pg + mssql) khi nhận SIGTERM/SIGINT để tránh connection leak khi K8s kill pod.",
    "files": [
      {"path": "src/index.js", "changes": "+14 -1", "purpose": "Thêm signal handler (SIGTERM/SIGINT) đóng server có thứ tự, có timeout fallback 10s bằng setTimeout.unref()."}
    ]
  },
  "comments": [
    {
      "file": "src/index.js",
      "line": 3,
      "severity": "high",
      "title": "Resource leak — DB pool không được đóng",
      "message": "Import pgPool nhưng không gọi pgPool.end() trong shutdown handler → connection leak khi pod bị kill. Tương tự với SQL Server pool.",
      "suggestion": "await pgPool.end();\nawait sqlPool.close();\nconsole.log('DB pools closed.');"
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
    options: { temperature: 0.1, num_predict: 8000, top_p: 0.9, seed: 42 }
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

function parseAIResponse(raw) {
  // 1) Thử marker <<<JSON>>> ... <<<END>>> (ưu tiên cao nhất)
  const fenced = raw.match(/<<<JSON>>>([\s\S]*?)<<<END>>>/);
  let jsonText = fenced ? fenced[1].trim() : null;

  // 2) Nếu không có marker đầy đủ, tìm JSON object HOÀN CHỈNH đầu tiên bằng bracket matching
  if (!jsonText) {
    jsonText = extractFirstCompleteJSONObject(raw);
  }

  if (!jsonText) {
    console.error('⚠️ No JSON object found in response');
    return { summary: { purpose: '', files: [] }, comments: [] };
  }

  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  }

  try {
    const parsed = JSON.parse(jsonText);
    return {
      summary: parsed.summary || { purpose: '', files: [] },
      comments: Array.isArray(parsed.comments) ? parsed.comments : []
    };
  } catch (e) {
    console.error('⚠️ JSON parse failed:', e.message);
    console.error('Text (first 500):', jsonText.slice(0, 500));
    return { summary: { purpose: '', files: [] }, comments: [] };
  }
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

  let md = `## Copilot code review\n\n`;
  md += `### 🎯 Mục đích thay đổi\n\n${purpose || '_AI chưa phân tích được mục đích từ diff._'}\n\n`;

  if (files && files.length > 0) {
    md += `### 📂 Files changed (${files.length})\n\n`;
    md += `| File | Thay đổi | Mục đích |\n| --- | --- | --- |\n`;
    for (const f of files) md += `| \`${f.path}\` | ${f.changes || '—'} | ${f.purpose || '—'} |\n`;
    md += `\n`;
  } else {
    md += `### 📂 Files changed (0)\n\n_Không có file nào thay đổi._\n\n`;
  }

  md += `### 💬 Tổng số comment: **${comments.length}**`;
  if (comments.length > 0) {
    const parts = [];
    if (counts.critical) parts.push(`🔴 ${counts.critical} critical`);
    if (counts.high) parts.push(`🟠 ${counts.high} high`);
    if (counts.medium) parts.push(`🟡 ${counts.medium} medium`);
    if (counts.low) parts.push(`🔵 ${counts.low} low`);
    md += ` (${parts.join(' • ')})`;
  }
  md += `\n\n`;

  if (comments.length > 0) md += `See inline comments below 👇\n\n`;
  md += `---\n<sub>🤖 Powered by Ollama Cloud (${OLLAMA_MODEL}) • PR #${PR_NUMBER} • \`${PR_HEAD_REF}\` → \`${PR_BASE_REF}\`</sub>`;
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
