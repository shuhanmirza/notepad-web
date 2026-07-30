import { DOCUMENT_DATABASE_NAME } from './config'
import type { TextDocument } from './types'

const DATABASE_VERSION = 1
const DOCUMENT_STORE = 'documents'

let databasePromise: Promise<IDBDatabase> | undefined

function openDatabase() {
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DOCUMENT_DATABASE_NAME, DATABASE_VERSION)

      request.onupgradeneeded = () => {
        const database = request.result

        if (!database.objectStoreNames.contains(DOCUMENT_STORE)) {
          database.createObjectStore(DOCUMENT_STORE, { keyPath: 'id' })
        }
      }

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  return databasePromise
}

export async function getDocuments(): Promise<TextDocument[]> {
  const database = await openDatabase()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(DOCUMENT_STORE, 'readonly')
    const request = transaction.objectStore(DOCUMENT_STORE).getAll()

    request.onsuccess = () => {
      const documents = request.result as TextDocument[]
      resolve(documents.sort((a, b) => b.updatedAt - a.updatedAt))
    }
    request.onerror = () => reject(request.error)
  })
}

export async function saveDocument(document: TextDocument): Promise<void> {
  const database = await openDatabase()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(DOCUMENT_STORE, 'readwrite')
    transaction.objectStore(DOCUMENT_STORE).put(document)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
}

export async function removeDocument(documentId: string): Promise<void> {
  const database = await openDatabase()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(DOCUMENT_STORE, 'readwrite')
    transaction.objectStore(DOCUMENT_STORE).delete(documentId)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
}
