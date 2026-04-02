import { execSync } from 'child_process';
import { writeFileSync } from 'fs';

try {
  execSync('npx tsc --noEmit', { stdio: 'pipe' });
} catch (e) {
  writeFileSync('ts_errors.log', e.stdout.toString(), 'utf8');
}
