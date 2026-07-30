import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { getDocuments, removeDocument, saveDocument } from './storage'
import type { TextDocument } from './types'

describe('browser document storage', () => {
  it('persists, reads, and removes a document', async () => {
    const document: TextDocument = {
      id: 'saved-document',
      title: 'Saved document',
      content: 'This stays in the browser.',
      createdAt: 10,
      updatedAt: 20,
      updatedBy: 'test-tab',
    }

    await saveDocument(document)
    expect(await getDocuments()).toContainEqual(document)

    await removeDocument(document.id)
    expect(await getDocuments()).not.toContainEqual(document)
  })
})
