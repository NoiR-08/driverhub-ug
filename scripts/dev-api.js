if (process.env.NODE_ENV === 'production') {
  console.error('The development API command cannot run with NODE_ENV=production.')
  process.exit(1)
}

process.env.DEMO_MODE = 'true'
await import('../backend/index.js')
