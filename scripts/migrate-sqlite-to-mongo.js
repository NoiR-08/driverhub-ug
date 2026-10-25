import { existsSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  closeDatabase,
  connectDatabase,
  initializeHub,
} from '../connection/database.js'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sqlitePath = resolve(projectRoot, 'data', 'driverhub.sqlite')

function readRows(database, query) {
  return database.prepare(query).all()
}

async function migrate() {
  if (!existsSync(sqlitePath)) {
    throw new Error(`SQLite database was not found at ${sqlitePath}.`)
  }

  const sqlite = new DatabaseSync(sqlitePath, { readOnly: true })
  try {
    const appState = sqlite.prepare(
      'SELECT current_json, initial_json FROM app_state WHERE id = 1',
    ).get()
    if (!appState) throw new Error('The SQLite database has not been initialized.')

    const state = JSON.parse(appState.current_json)
    const initialState = JSON.parse(appState.initial_json)
    const credentials = readRows(
      sqlite,
      'SELECT user_id AS userId, salt, password_hash FROM credentials',
    )
    const initialCredentials = readRows(
      sqlite,
      'SELECT user_id AS userId, salt, password_hash FROM initial_credentials',
    )
    const sessions = readRows(
      sqlite,
      'SELECT token_hash AS tokenHash, user_id AS userId, expires_at AS expiresAt FROM sessions',
    )
    const passwordResetTokens = readRows(
      sqlite,
      'SELECT token_hash AS tokenHash, user_id AS userId, expires_at AS expiresAt FROM password_reset_tokens',
    )

    await connectDatabase()
    const migrated = await initializeHub({
      state,
      initialState,
      credentials,
      initialCredentials,
      sessions,
      passwordResetTokens,
    })
    if (!migrated) {
      console.log('MongoDB already contains DriverHub data; SQLite was left unchanged.')
      return
    }

    console.log(
      `Migrated ${state.users.length} users, ${credentials.length} credentials, ` +
      `${sessions.length} sessions, and ${passwordResetTokens.length} password-reset tokens.`,
    )
    console.log('The SQLite database was left unchanged.')
  } finally {
    sqlite.close()
    await closeDatabase()
  }
}

migrate().catch((error) => {
  console.error('SQLite-to-MongoDB migration failed:', error)
  process.exitCode = 1
})
