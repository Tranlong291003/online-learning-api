function tryParse(text) {
  if (text.startsWith('```')) text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try { return JSON.parse(text); } catch { return null; }
}

const t1 = `<<<JSON>>>
{
  "summary": {"purpose": "test", "files": []},
  "comments": []
}
<<<END>>>`;

console.log('t1 starts with <<<JSON>>>?', t1.startsWith('<<<JSON>>>'));
console.log('t1 marker match count:', (t1.match(/<<<JSON>>>/g) || []).length, '/', (t1.match(/<<<END>>>/g) || []).length);

const start = t1.indexOf('<<<JSON>>>');
const end = t1.indexOf('<<<END>>>');
const candidate = t1.substring(start + 10, end).trim();
console.log('Candidate raw length:', candidate.length);
console.log('Candidate start:', JSON.stringify(candidate.slice(0, 30)));
const parsed = tryParse(candidate);
console.log('Parsed:', parsed);
