import { MongoClient } from 'mongodb'

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017'
const databaseName = process.env.MONGODB_DB || 'driverhub_ug'
const client = new MongoClient(uri, {
  appName: 'DriverHub Ug',
  ignoreUndefined: true,
  serverSelectionTimeoutMS: 5000,
})

let applications
let connection

export async function connectDatabase() {
  if (!connection) {
    connection = client.connect()
      .then(() => {
        applications = client.db(databaseName).collection('application')
      })
      .catch((error) => {
        connection = undefined
        throw error
      })
  }
  await connection
}

export async function closeDatabase() {
  await client.close()
  applications = undefined
  connection = undefined
}

export async function readHub() {
  if (!applications) throw new Error('MongoDB has not been connected.')
  const document = await applications.findOne({ _id: 'driverhub' })
  if (!document) return null

  return {
    state: document.state ?? null,
    initialState: document.initialState ?? null,
    credentials: document.credentials ?? [],
    initialCredentials: document.initialCredentials ?? [],
    sessions: document.sessions ?? [],
    passwordResetTokens: document.passwordResetTokens ?? [],
  }
}

export async function mutateHub(update) {
  if (!applications) throw new Error('MongoDB has not been connected.')

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const document = await applications.findOne({ _id: 'driverhub' })
    if (!document) return null

    const revision = document.revision ?? 0
    const hub = {
      state: document.state ?? null,
      initialState: document.initialState ?? null,
      credentials: document.credentials ?? [],
      initialCredentials: document.initialCredentials ?? [],
      sessions: document.sessions ?? [],
      passwordResetTokens: document.passwordResetTokens ?? [],
    }
    const result = update(hub)

    const filter = document.revision == null
      ? {
          _id: 'driverhub',
          $or: [
            { revision: { $exists: false } },
            { revision: null },
          ],
        }
      : {
          _id: 'driverhub',
          revision: document.revision,
        }

    const write = await applications.replaceOne(
      filter,
      { _id: 'driverhub', revision: revision + 1, ...hub },
    )

    if (write.matchedCount === 1) return result
  }

  throw new Error('MongoDB update could not be completed because of concurrent changes.')
}


export async function initializeHub({
  state,
  initialState = state,
  credentials,
  initialCredentials = credentials,
  sessions = [],
  passwordResetTokens = [],
}) {
  if (!applications) throw new Error('MongoDB has not been connected.')

  try {
    await applications.insertOne({
      _id: 'driverhub',
      revision: 0,
      state,
      initialState,
      credentials,
      initialCredentials,
      sessions,
      passwordResetTokens,
    })
    return true
  } catch (error) {
    if (error?.code === 11000) return false
    throw error
  }
}
