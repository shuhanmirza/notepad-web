export interface TextDocument {
  id: string
  title: string
  content: string
  createdAt: number
  updatedAt: number
  updatedBy: string
}

export type SyncMessage =
  | {
      type: 'hello' | 'presence' | 'bye'
      tabId: string
      documentId: string | null
      sentAt: number
    }
  | {
      type: 'document:update'
      tabId: string
      document: TextDocument
      sentAt: number
    }
  | {
      type: 'document:delete'
      tabId: string
      documentId: string
      sentAt: number
    }
