import fs from 'fs';
import path from 'path';

// ====== CONFIG ======
const OLLAMA_HOST = 'https://ollama.com';   // Ollama Cloud chính thức
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY;
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gpt-oss:120b';
const PR_NUMBER = process.env.PR_NUMBER;
const PR_TITLE = process.env.PR_TITLE || '';
const PR_BODY = process.env.PR_BODY || '';
const REPO_NAME = process.env.REPO_NAME || '';

if (!OLLAMA_API_KEY) {
  console.error('❌ OLLAMA_API_KEY is not set');
  process.exit(1);
}

// ====== ĐỌC PROMPT & DIFF ======
const SYSTEM_PROMPT = fs.readFileSync(
  path.join(process.cwd(), '.github/ai-review/prompt.md'),
  'utf-8'
);
const DIFF = fs.readFileSync('pr.diff', 'utf-8');

if (!DIFF.trim()) {
  fs.writeFileSync(
    'review-comment.md',
    '## 🤖 AI Review\n\nKhông có code change để review. ✅'
  );
  process.exit(0);
}

const FILES_CHANGED = DIFF.match(/^diff --git a\/(.+?) b\//gm) || [];

// ====== USER PROMPT ======
const USER_PROMPT = `# Pull Request #${PR_NUMBER}: ${PR_TITLE}

## Mô tả PR:
${PR_BODY || '(Không có mô tả)'}

## Files changed (${FILES_CHANGED.length} files):
${FILES_CHANGED.join('\n')}

## Diff:
\`\`\`diff
${DIFF.slice(0, 30000)}${DIFF.length > 30000 ? '\n... (diff quá dài, đã cắt bớt)' : ''}
\`\`\`

Hãy review code trên theo đúng quy trình đã định nghĩa trong system prompt.
Output theo format Markdown đã nêu. Tập trung vào bugs, security,
performance, error handling. Bỏ qua style/formatting. Trả lời bằng tiếng Việt.`;

async function callOllamaCloud() {
  const url = `${OLLAMA_HOST}/api/chat`;

  const body = {
    model: OLLAMA_MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: USER_PROMPT }
    ],
    stream: false,
    options: {
      temperature: 0.1,   // Ít random, chính xác hơn
      num_predict: 4000,
      top_p: 0.9,
      seed: 42            // Reproducible
    }
  };

  console.log(`🤖 Calling ${OLLAMA_MODEL} on Ollama Cloud...`);
  console.log(`📏 Diff: ${DIFF.length} chars | ${FILES_CHANGED.length} files`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OLLAMA_API_KEY}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Ollama Cloud ${response.status}: ${errText}`);
  }

  const data = await response.json();
  return data.message?.content || 'Không nhận được phản hồi từ AI.';
}

async function main() {
  try {
    const review = await callOllamaCloud();
    const finalComment =
      `## 🤖 AI Code Review (${OLLAMA_MODEL})\n\n${review}\n\n` +
      `---\n<sub>🤖 Powered by Ollama Cloud • ${new Date().toISOString()} • ` +
      `[${REPO_NAME}#${PR_NUMBER}](https://github.com/${REPO_NAME}/pull/${PR_NUMBER})</sub>`;

    fs.writeFileSync('review-comment.md', finalComment);
    console.log(`✅ Review written (${review.length} chars)`);
  } catch (err) {
    console.error('❌ Review failed:', err.message);
    fs.writeFileSync(
      'review-comment.md',
      `## 🤖 AI Review Failed\n\n\`\`\`\n${err.message}\n\`\`\`\n\nVui lòng review thủ công.`
    );
    process.exit(1);
  }
}

main();
