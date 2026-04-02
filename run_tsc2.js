import { execSync } from 'child_process';
import { writeFileSync } from 'fs';

try {
  execSync('node node_modules/typescript/bin/tsc', { stdio: 'pipe' });
  writeFileSync('tsc_output.log', 'Success', 'utf8');
} catch (e) {
  writeFileSync('tsc_output.log', e.stdout.toString(), 'utf8');
}
