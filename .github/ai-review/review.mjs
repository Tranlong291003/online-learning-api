import fs from 'fs';
import path from 'path';

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
const PR_HEAD_REF = process.env.PR_HEAD_REF;

if (!OLLAMA_API_KEY) { console.error('❌ OLLAMA_API_KEY not set'); process.exit(1); }
if (!GITHUB_TOKEN) { console.error('❌ GITHUB_TOKEN not set'); process.exit(1); }
if (!COMMIT_SHA) { console.error('❌ COMMIT_SHA not set'); process.exit(1); }

// ====== ĐỌC PROMPT & DIFF ======
const SYSTEM_PROMPT = fs.readFileSync(
  path.join(process.cwd(), '.github/ai-review/prompt.md'),
  'utf-8'
);
const DIFF = fs.readFileSync('pr.diff', 'utf-8');

if (!DIFF.trim()) {
  console.log('⚠️ Empty diff, skipping.');
  process.exit(0);
}

// Parse diff → { filePath: Set<lineNumber> }
function parseDiff(diffText) {
  const files = new Map();
  const fileRegex = /^diff --git a\/(.+?) b\/(.+?)$/gm;
  const hunkRegex = /@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/g;

  let match;
  while ((match = fileRegex.exec(diffText)) !== null) {
    files.set(match[2], new Set());
  }

  const fileBlocks = diffText.split(/^diff --git /m).slice(1);
  for (const block of fileBlocks) {
    const headerMatch = block.match(/^a\/(.+?) b\//);
    if (!headerMatch) continue;
    const filePath = headerMatch[1];
    let hunkMatch;
    while ((hunkMatch = hunkRegex.exec(block)) !== null) {
      const start = parseInt(hunkMatch[1], 10);
      const count = hunkMatch[2] ? parseInt(hunkMatch[2], 10) : 1;
      const end = start + Math.max(count - 1, 0);
      for (let l = start; l <= end; l++) {
        files.get(filePath)?.add(l);
      }
    }
  }
  return files;
}

const VALID_FILES = parseDiff(DIFF);
const FILES_CHANGED = [...VALID_FILES.keys()];

// ====== USER PROMPT ======
const diffSnippet = DIFF.slice(0, 25000);
const USER_PROMPT = `# PR #${PR_NUMBER}: ${PR_TITLE}

${PR_BODY || ''}

Files (${FILES_CHANGED.length}): ${FILES_CHANGED.join(', ')}

\`\`\`diff
${diffSnippet}${DIFF.length > 25000 ? '\n... (cắt bớt)' : ''}
\`\`\`

Trả về JSON array. Mỗi element: {file, line, severity, title, message, suggestion}.
Comment NGẮN GỌN như Copilot, ưu tiên security/bugs/perf. Tối đa 8 comments. Code ổn → [].`;

async function callOllamaCloud() {
  const body = {
    model: OLLAMA_MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: USER_PROMPT }
    ],
    stream: false,
    format: 'json',
    options: {
      temperature: 0.1,
      num_predict: 3000,
      top_p: 0.9,
      seed: 42
    }
  };

  console.log(`🤖 Calling ${OLLAMA_MODEL}...`);
  const response = await fetch(`${OLLAMA_HOST}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OLLAMA_API_KEY}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`Ollama ${response.status}: ${await response.text()}`);
  }
  const data = await response.json();
  return data.message?.content || '[]';
}

function parseAIResponse(raw) {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  }
  try {
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('⚠️ JSON parse failed:', e.message);
    console.error('Raw:', raw.slice(0, 300));
    return [];
  }
}

function isLineInDiff(file, line) {
  return VALID_FILES.get(file)?.has(line) ?? false;
}

// Format inline comment giống Copilot
function formatCommentBody(c) {
  const EMOJI = { critical: '🔴', high: '🟠', medium: '🟡', low: '🔵' };
  const emoji = EMOJI[c.severity] || '💡';
  const title = c.title || 'Suggestion';
  const msg = c.message || '';
  let body = `${emoji} **${title}**\n\n${msg}`;
  if (c.suggestion) {
    body += `\n\n### Suggested change\n\n\`\`\`suggestion\n${c.suggestion}\n\`\`\``;
  }
  return body;
}

// Format summary giống Copilot "Files changed" header
function buildSummary(comments) {
  if (comments.length === 0) {
    return (
      `## Copilot code review\n\n` +
      `✅ **No issues found.** Looks good to merge.\n\n` +
      `---\n<sub>🤖 Powered by Ollama Cloud (${OLLAMA_MODEL})</sub>`
    );
  }

  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  comments.forEach(c => { counts[c.severity] = (counts[c.severity] || 0) + 1; });

  return (
    `## Copilot code review\n\n` +
    `I've reviewed your changes and found **${comments.length}** ` +
    `suggestion${comments.length > 1 ? 's' : ''}:\n\n` +
    (counts.critical ? `🔴 ${counts.critical} critical\n` : '') +
    (counts.high ? `🟠 ${counts.high} high\n` : '') +
    (counts.medium ? `🟡 ${counts.medium} medium\n` : '') +
    (counts.low ? `🔵 ${counts.low} low (nit)\n` : '') +
    `\nSee inline comments below 👇\n\n` +
    `---\n<sub>🤖 Powered by Ollama Cloud (${OLLAMA_MODEL}) • PR #${PR_NUMBER}</sub>`
  );
}

async function postReview(body, inlineComments) {
  const url = `https://api.github.com/repos/${REPO_NAME}/pulls/${PR_NUMBER}/reviews`;
  const payload = {
    commit_id: COMMIT_SHA,
    body,
    event: inlineComments.length > 0 ? 'COMMENT' : 'APPROVE',
    comments: inlineComments.map(c => ({
      path: c.path,
      line: c.line,
      side: 'RIGHT',
      body: c.body
    }))
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

  if (!res.ok) {
    throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  console.log(`✅ Review posted: ${data.html_url}`);
}

async function main() {
  try {
    const raw = await callOllamaCloud();
    const aiComments = parseAIResponse(raw);
    console.log(`📋 AI returned ${aiComments.length} comments`);

    // Validate
    const validComments = aiComments.filter(c => {
      if (!c.file || !c.line || !c.severity) return false;
      if (!VALID_FILES.has(c.file)) {
        console.log(`  ⚠️ Skip (file not in diff): ${c.file}`);
        return false;
      }
      const lineNum = parseInt(c.line, 10);
      if (!isLineInDiff(c.file, lineNum)) {
        console.log(`  ⚠️ Skip (line not in diff): ${c.file}:${c.line}`);
        return false;
      }
      return true;
    });

    console.log(`✓ ${validComments.length}/${aiComments.length} valid`);

    const inlineComments = validComments.map(c => ({
      path: c.file,
      line: parseInt(c.line, 10),
      body: formatCommentBody(c)
    }));

    const summary = buildSummary(validComments);
    await postReview(summary, inlineComments);

    console.log(`🎉 Done!`);
  } catch (err) {
    console.error('❌ Failed:', err.message);
    process.exit(1);
  }
}

main();
