import { spawn } from 'node:child_process'

const processes = [
  spawn(process.execPath, ['backend/index.js'], {
    stdio: 'inherit',
    env: { ...process.env, DEMO_MODE: 'true' },
  }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1'], {
    stdio: 'inherit',
    env: process.env,
  }),
]

let shuttingDown = false

function shutdown(code = 0) {
  if (shuttingDown) return
  shuttingDown = true
  for (const child of processes) {
    if (child.exitCode === null) child.kill()
  }
  process.exitCode = code
}

for (const child of processes) {
  child.on('error', (error) => {
    console.error('Unable to start development process:', error)
    shutdown(1)
  })
  child.on('exit', (code) => {
    if (!shuttingDown) {
      console.error(`A development service exited unexpectedly (code ${code ?? 'unknown'}).`)
      shutdown(code ?? 1)
    }
  })
}

process.on('SIGINT', () => shutdown())
process.on('SIGTERM', () => shutdown())
