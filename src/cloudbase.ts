import CloudBase from '@cloudbase/js-sdk'

let db: any = null
let app: any = null
let currentEnv = ''

export async function initCloudBase(envId: string): Promise<void> {
  if (app) {
    if (currentEnv === envId && db) return
    app = null
    db = null
  }

  currentEnv = envId
  app = CloudBase.init({ env: envId })
  await app.auth().anonymousAuthProvider.signIn()
  db = app.database()
}

export function getDB() {
  return db
}

export async function stopCloudBase(): Promise<void> {
  db = null
  app = null
  currentEnv = ''
}

export function isReady(): boolean {
  return db !== null
}
