/** Repository hygiene checks that CI enforces. */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const problems: string[] = [];

// The brief is kept word for word.
const brief = createHash('sha256').update(readFileSync('docs/BRIEF.md')).digest('hex');
if (brief !== 'b27a01956ef26214a117ae42fcb9299b61c5ea09d605e43c25aa42da18b4052a') problems.push('docs/BRIEF.md has changed; it must stay exactly as written.');

// The checkpoint stays short. Older entries move to docs/history/.
const lines = readFileSync('docs/CHECKPOINT.md', 'utf8').split('\n').length;
if (lines > 150) problems.push(`docs/CHECKPOINT.md is ${lines} lines; the limit is 150.`);

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`docs ok (checkpoint ${lines} lines)`);
