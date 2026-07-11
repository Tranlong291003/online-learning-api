// Simulate parser
const raw = `<<<JSON>>>
{
  "summary": {
    "purpose": "Test purpose",
    "files": [{"path": "src/index.js", "changes": "+1 -1", "purpose": "fix bug"}]
  },
  "comments": [
    {"file": "src/index.js", "line": 5, "severity": "high", "title": "Bug", "message": "msg\n\n**Ảnh hưởng:** ảnh hưởng", "suggestion": "console.log('fixed')"}
  ]
}
<<<END>>>`;

function tryParse(text) {
  if (text.startsWith('```')) text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try { return JSON.parse(text); } catch { return null; }
}

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

function parseAIResponse(raw) {
  const jsonStarts = [...raw.matchAll(/<<<JSON>>>/g)];
  const endMatches = [...raw.matchAll(/<<<END>>>/g)];
  let bestParsed = null;
  if (jsonStarts.length > 0 && endMatches.length > 0) {
    for (const start of jsonStarts) {
      for (const end of endMatches) {
        if (end.index > start.index) {
          const candidate = raw.substring(start.index + 10, end.index).trim();
          const parsed = tryParse(candidate);
          if (parsed && (typeof parsed === 'object')) {
            if (!bestParsed || JSON.stringify(parsed).length > JSON.stringify(bestParsed).length) {
              bestParsed = parsed;
            }
          }
        }
      }
    }
  }
  if (bestParsed) {
    return { summary: bestParsed.summary, comments: bestParsed.comments };
  }
  const largest = extractLargestJSONObject(raw);
  if (largest) {
    const parsed = tryParse(largest);
    if (parsed) return { summary: parsed.summary, comments: parsed.comments };
  }
  return null;
}

const result = parseAIResponse(raw);
console.log('Markers count:', [...raw.matchAll(/<<<JSON>>>/g)].length, '/', [...raw.matchAll(/<<<END>>>/g)].length);
console.log('Result:', result ? 'PARSED OK' : 'FAILED');
if (result) console.log('Summary:', result.summary);
if (result) console.log('Comments:', result.comments.length);
