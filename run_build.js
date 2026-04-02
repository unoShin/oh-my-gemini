import { execSync } from 'child_process';
import { writeFileSync } from 'fs';

try {
  const out = execSync('npm run build', { stdio: 'pipe' });
  writeFileSync('build_output.log', out.toString(), 'utf8');
} catch (e) {
  writeFileSync('build_output.log', e.stdout.toString() + '\\n----- STDERR -----\\n' + e.stderr.toString(), 'utf8');
}
