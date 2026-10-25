import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const steps = [
  [resolve(root, 'node_modules/typescript/bin/tsc'), ['-b']],
  [resolve(root, 'node_modules/vite/bin/vite.js'), ['build']],
]

for (const [script, args] of steps) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    stdio: 'inherit',
  })
  if (result.error) {
    console.error('Build command could not start:', result.error)
    process.exit(1)
  }
  if (result.status !== 0) process.exit(result.status ?? 1)
}
