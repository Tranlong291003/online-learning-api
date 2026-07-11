const raw = `<<<JSON>>>
{
  "summary": {"purpose": "test", "files": []},
  "comments": []
}
<<<END>>>`;

const jsonStarts = [...raw.matchAll(/<<<JSON>>>/g)];
const endMatches = [...raw.matchAll(/<<<END>>>/g)];
console.log('Start:', jsonStarts[0]?.index, 'End:', endMatches[0]?.index);

const candidate = raw.substring(jsonStarts[0].index + 10, endMatches[0].index).trim();
console.log('Candidate:');
console.log(JSON.stringify(candidate));
console.log('---');

try {
  const parsed = JSON.parse(candidate);
  console.log('OK:', parsed);
} catch (e) {
  console.log('FAIL:', e.message);
}
