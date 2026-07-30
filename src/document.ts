import type { TextDocument } from './types'

export function createDocument(tabId: string, now = Date.now()): TextDocument {
  return {
    id: crypto.randomUUID(),
    title: 'Untitled',
    content: '',
    createdAt: now,
    updatedAt: now,
    updatedBy: tabId,
  }
}

export function isIncomingDocumentNewer(
  incoming: TextDocument,
  current: TextDocument,
): boolean {
  if (incoming.updatedAt !== current.updatedAt) {
    return incoming.updatedAt > current.updatedAt
  }

  return incoming.updatedBy > current.updatedBy
}

export function textStats(content: string) {
  const trimmed = content.trim()

  return {
    words: trimmed ? trimmed.split(/\s+/u).length : 0,
    characters: content.length,
    lines: content ? content.split('\n').length : 1,
  }
}

export function nextTimestamp(previous: number, now = Date.now()) {
  return Math.max(previous + 1, now)
}

export function textFileName(title: string) {
  const sanitized = title
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
    .replace(/[.\s]+$/g, '')
    .slice(0, 100)

  const baseName = sanitized || 'Untitled'
  return baseName.toLowerCase().endsWith('.txt')
    ? baseName
    : `${baseName}.txt`
}
