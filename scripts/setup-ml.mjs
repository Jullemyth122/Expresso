// Creates Expresso's own Python environment (ml/venv) and installs the training packages. Run once: npm run setup:ml
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ml = fileURLToPath(new URL('../ml/', import.meta.url));
const windows = process.platform === 'win32';
const python = windows ? join(ml, 'venv', 'Scripts', 'python.exe') : join(ml, 'venv', 'bin', 'python');
const step = (command, args) => {
  console.log(`> ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { cwd: ml, stdio: 'inherit', shell: false });
  if (result.status !== 0) { console.error(`Failed: ${command} ${args.join(' ')}`); process.exit(result.status ?? 1); }
};
if (!existsSync(python)) step(windows ? 'py' : 'python3', [...(windows ? ['-3.11'] : []), '-m', 'venv', 'venv']);
step(python, ['-m', 'pip', 'install', '--upgrade', 'pip']);
step(python, ['-m', 'pip', 'install', '-r', 'requirements.txt']);
console.log('Python environment ready. Start Expresso with: npm run dev');
