import { describe, expect, it } from 'vitest'
import {
  isIncomingDocumentNewer,
  nextTimestamp,
  textFileName,
  textStats,
} from './document'
import type { TextDocument } from './types'

function documentVersion(updatedAt: number, updatedBy: string): TextDocument {
  return {
    id: 'document',
    title: 'Test',
    content: '',
    createdAt: 1,
    updatedAt,
    updatedBy,
  }
}

describe('document versioning', () => {
  it('accepts an update with a later timestamp', () => {
    expect(
      isIncomingDocumentNewer(
        documentVersion(11, 'tab-a'),
        documentVersion(10, 'tab-b'),
      ),
    ).toBe(true)
  })

  it('uses the tab id to resolve equal timestamps deterministically', () => {
    expect(
      isIncomingDocumentNewer(
        documentVersion(10, 'tab-z'),
        documentVersion(10, 'tab-a'),
      ),
    ).toBe(true)
  })

  it('always advances local timestamps', () => {
    expect(nextTimestamp(100, 50)).toBe(101)
  })
})

describe('text statistics', () => {
  it('counts words, characters, and lines', () => {
    expect(textStats('hello  world\nagain')).toEqual({
      words: 3,
      characters: 18,
      lines: 2,
    })
  })

  it('treats an empty document as one line', () => {
    expect(textStats('')).toEqual({ words: 0, characters: 0, lines: 1 })
  })
})

describe('download file names', () => {
  it('adds a text file extension', () => {
    expect(textFileName('Meeting notes')).toBe('Meeting notes.txt')
  })

  it('keeps an existing text file extension', () => {
    expect(textFileName('ideas.txt')).toBe('ideas.txt')
  })

  it('removes characters that are unsafe in file names', () => {
    expect(textFileName('Tasks: this/week?')).toBe('Tasks- this-week-.txt')
  })
})
