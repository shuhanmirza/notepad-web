<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  ACTIVE_DOCUMENT_STORAGE_KEY,
  FONT_STORAGE_KEY,
  THEME_STORAGE_KEY,
} from './config'
import {
  createDocument,
  isIncomingDocumentNewer,
  nextTimestamp,
  textFileName,
  textStats,
} from './document'
import { updateFavicon } from './favicon'
import { getDocuments, removeDocument, saveDocument } from './storage'
import { DocumentSync } from './sync'
import type { SyncMessage, TextDocument } from './types'

const THEMES = ['carbon', 'paper', 'midnight'] as const
const FONTS = [
  'jetbrains',
  'ibm-plex',
  'source-code',
  'fira-code',
  'system',
] as const

type Theme = (typeof THEMES)[number]
type FontChoice = (typeof FONTS)[number]

function initialTheme(): Theme {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY)
  return THEMES.includes(savedTheme as Theme) ? (savedTheme as Theme) : 'carbon'
}

function initialFont(): FontChoice {
  const savedFont = localStorage.getItem(FONT_STORAGE_KEY)
  return FONTS.includes(savedFont as FontChoice)
    ? (savedFont as FontChoice)
    : 'jetbrains'
}

function applyFont(nextFont: FontChoice) {
  document.documentElement.dataset.font = nextFont
}

function applyTheme(nextTheme: Theme) {
  const root = document.documentElement
  root.dataset.theme = nextTheme
  const themeStyles = getComputedStyle(root)
  const pageColor = themeStyles.getPropertyValue('--page').trim()
  const themeColor = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]',
  )
  if (themeColor) themeColor.content = pageColor
  updateFavicon({
    background: themeStyles.getPropertyValue('--accent').trim(),
    foreground: themeStyles.getPropertyValue('--brand-ink').trim(),
  })
}

const sync = new DocumentSync()

const documents = ref<TextDocument[]>([])
const activeDocumentId = ref<string | null>(null)
const isReady = ref(false)
const isSidebarOpen = ref(false)
const saveState = ref<'saved' | 'saving' | 'error'>('saved')
const copyState = ref<'idle' | 'copied' | 'error'>('idle')
const theme = ref<Theme>(initialTheme())
const fontChoice = ref<FontChoice>(initialFont())
const presenceRevision = ref(0)
const editor = ref<HTMLTextAreaElement | null>(null)

let removeMessageListener: (() => void) | undefined
let removePresenceListener: (() => void) | undefined
let copyStateTimer: number | undefined

applyTheme(theme.value)
applyFont(fontChoice.value)

const activeDocument = computed(() =>
  documents.value.find((document) => document.id === activeDocumentId.value),
)

const sortedDocuments = computed(() =>
  [...documents.value].sort((a, b) => b.updatedAt - a.updatedAt),
)

const stats = computed(() => textStats(activeDocument.value?.content ?? ''))

const openTabCount = computed(() => {
  presenceRevision.value
  return activeDocumentId.value
    ? sync.countTabsFor(activeDocumentId.value)
    : 1
})

const saveLabel = computed(() => {
  if (saveState.value === 'saving') return 'Saving…'
  if (saveState.value === 'error') return 'Save failed'
  return 'Saved locally'
})

const tabLabel = computed(() => {
  if (openTabCount.value > 1) {
    return `Open in ${openTabCount.value} tabs · live sync`
  }

  return 'Open in this tab'
})

const copyLabel = computed(() => {
  if (copyState.value === 'copied') return 'Copied'
  if (copyState.value === 'error') return 'Copy failed'
  return 'Copy'
})

function cloneDocument(document: TextDocument): TextDocument {
  return { ...document }
}

async function persist(document: TextDocument) {
  const snapshot = cloneDocument(document)
  saveState.value = 'saving'
  sync.publishDocument(snapshot)

  try {
    await saveDocument(snapshot)

    if (activeDocument.value?.updatedAt === snapshot.updatedAt) {
      saveState.value = 'saved'
    }
  } catch {
    saveState.value = 'error'
  }
}

function markChanged(document: TextDocument) {
  document.updatedAt = nextTimestamp(document.updatedAt)
  document.updatedBy = sync.tabId
  void persist(document)
}

function updateContent(event: Event) {
  if (!activeDocument.value) return

  activeDocument.value.content = (event.target as HTMLTextAreaElement).value
  markChanged(activeDocument.value)
}

function handleEditorKeydown(event: KeyboardEvent) {
  if (
    event.key !== 'Tab' ||
    event.shiftKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    !activeDocument.value
  ) {
    return
  }

  event.preventDefault()
  const textarea = event.currentTarget as HTMLTextAreaElement
  textarea.setRangeText(
    '\t',
    textarea.selectionStart,
    textarea.selectionEnd,
    'end',
  )
  activeDocument.value.content = textarea.value
  markChanged(activeDocument.value)
}

function updateTitle(event: Event) {
  if (!activeDocument.value) return

  activeDocument.value.title =
    (event.target as HTMLInputElement).value.replace(/\n/g, '').slice(0, 120) ||
    'Untitled'
  markChanged(activeDocument.value)
}

function selectDocument(documentId: string) {
  activeDocumentId.value = documentId
  localStorage.setItem(ACTIVE_DOCUMENT_STORAGE_KEY, documentId)
  sync.setActiveDocument(documentId)
  isSidebarOpen.value = false
  void nextTick(() => editor.value?.focus())
}

async function addDocument() {
  const document = createDocument(sync.tabId)
  documents.value.push(document)
  selectDocument(document.id)
  await persist(document)
}

function resetCopyStateLater() {
  window.clearTimeout(copyStateTimer)
  copyStateTimer = window.setTimeout(() => {
    copyState.value = 'idle'
  }, 1_600)
}

function legacyCopy(text: string) {
  const temporaryEditor = document.createElement('textarea')
  temporaryEditor.value = text
  temporaryEditor.setAttribute('readonly', '')
  temporaryEditor.style.position = 'fixed'
  temporaryEditor.style.opacity = '0'
  document.body.appendChild(temporaryEditor)
  temporaryEditor.select()
  const copied = document.execCommand('copy')
  temporaryEditor.remove()

  if (!copied) throw new Error('Copy command was rejected')
}

async function copyDocument() {
  if (!activeDocument.value) return

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(activeDocument.value.content)
    } else {
      legacyCopy(activeDocument.value.content)
    }
    copyState.value = 'copied'
  } catch {
    try {
      legacyCopy(activeDocument.value.content)
      copyState.value = 'copied'
    } catch {
      copyState.value = 'error'
    }
  }

  resetCopyStateLater()
}

function downloadDocument() {
  if (!activeDocument.value) return

  const blob = new Blob([activeDocument.value.content], {
    type: 'text/plain;charset=utf-8',
  })
  const downloadUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = downloadUrl
  link.download = textFileName(activeDocument.value.title)
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(downloadUrl)
}

function changeTheme(event: Event) {
  const nextTheme = (event.target as HTMLSelectElement).value as Theme
  if (!THEMES.includes(nextTheme)) return

  theme.value = nextTheme
  applyTheme(nextTheme)
  localStorage.setItem(THEME_STORAGE_KEY, nextTheme)
}

function changeFont(event: Event) {
  const nextFont = (event.target as HTMLSelectElement).value as FontChoice
  if (!FONTS.includes(nextFont)) return

  fontChoice.value = nextFont
  applyFont(nextFont)
  localStorage.setItem(FONT_STORAGE_KEY, nextFont)
}

async function deleteDocument(documentId: string) {
  const document = documents.value.find((item) => item.id === documentId)
  if (!document) return

  const confirmed = window.confirm(`Delete “${document.title}”?`)
  if (!confirmed) return

  documents.value = documents.value.filter((item) => item.id !== documentId)
  await removeDocument(documentId)
  sync.publishDeletion(documentId)

  if (activeDocumentId.value === documentId) {
    if (sortedDocuments.value[0]) {
      selectDocument(sortedDocuments.value[0].id)
    } else {
      await addDocument()
    }
  }
}

function handleSyncMessage(message: SyncMessage) {
  if (message.type === 'document:update') {
    const index = documents.value.findIndex(
      (document) => document.id === message.document.id,
    )

    if (index === -1) {
      documents.value.push(cloneDocument(message.document))
      void saveDocument(message.document)
      return
    }

    if (isIncomingDocumentNewer(message.document, documents.value[index])) {
      documents.value[index] = cloneDocument(message.document)
      saveState.value = 'saved'
      void saveDocument(message.document)
    }

    return
  }

  if (message.type === 'document:delete') {
    const wasActive = activeDocumentId.value === message.documentId
    documents.value = documents.value.filter(
      (document) => document.id !== message.documentId,
    )
    void removeDocument(message.documentId)

    if (wasActive) {
      const nextDocument = sortedDocuments.value[0]
      if (nextDocument) selectDocument(nextDocument.id)
      else void addDocument()
    }
  }
}

function handleKeyboardShortcut(event: KeyboardEvent) {
  if (!(event.metaKey || event.ctrlKey)) return

  if (event.key.toLowerCase() === 's') {
    event.preventDefault()
    if (activeDocument.value) void persist(activeDocument.value)
  }
}

function formatUpdatedAt(timestamp: number) {
  const date = new Date(timestamp)
  const today = new Date()

  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  }

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

onMounted(async () => {
  try {
    documents.value = await getDocuments()

    if (!documents.value.length) {
      const document = createDocument(sync.tabId)
      documents.value = [document]
      await saveDocument(document)
    }

    const previousDocumentId = localStorage.getItem(
      ACTIVE_DOCUMENT_STORAGE_KEY,
    )
    const selected =
      documents.value.find((document) => document.id === previousDocumentId) ??
      documents.value[0]

    activeDocumentId.value = selected.id
    localStorage.setItem(ACTIVE_DOCUMENT_STORAGE_KEY, selected.id)
    sync.setActiveDocument(selected.id)
    removeMessageListener = sync.onMessage(handleSyncMessage)
    removePresenceListener = sync.onPresenceChange(() => {
      presenceRevision.value += 1
    })
  } catch {
    saveState.value = 'error'
  } finally {
    isReady.value = true
    window.addEventListener('keydown', handleKeyboardShortcut)
    void nextTick(() => editor.value?.focus())
  }
})

onBeforeUnmount(() => {
  removeMessageListener?.()
  removePresenceListener?.()
  window.clearTimeout(copyStateTimer)
  window.removeEventListener('keydown', handleKeyboardShortcut)
})
</script>

<template>
  <div class="app-shell">
    <button
      v-if="isSidebarOpen"
      class="sidebar-scrim"
      aria-label="Close document list"
      @click="isSidebarOpen = false"
    />

    <aside class="sidebar" :class="{ 'sidebar--open': isSidebarOpen }">
      <header class="brand">
        <div class="brand-mark" aria-hidden="true">txt</div>
        <div>
          <h1>notepad-web</h1>
          <p>private by default</p>
        </div>
      </header>

      <button class="new-document" type="button" @click="addDocument">
        <span aria-hidden="true">+</span>
        New document
      </button>

      <div class="document-heading">
        <span>Documents</span>
        <span>{{ documents.length }}</span>
      </div>

      <nav class="document-list" aria-label="Documents">
        <div
          v-for="document in sortedDocuments"
          :key="document.id"
          class="document-item"
          :class="{ 'document-item--active': document.id === activeDocumentId }"
        >
          <button
            class="document-select"
            type="button"
            @click="selectDocument(document.id)"
          >
            <span class="document-copy">
              <strong>{{ document.title }}</strong>
              <small>{{ formatUpdatedAt(document.updatedAt) }}</small>
            </span>
          </button>
          <button
            class="delete-document"
            type="button"
            :aria-label="`Delete ${document.title}`"
            @click="deleteDocument(document.id)"
          >
            ×
          </button>
        </div>
      </nav>

      <footer class="sidebar-footer">
        <label class="preference-control">
          <span>Theme</span>
          <select :value="theme" aria-label="Color theme" @change="changeTheme">
            <option value="carbon">Carbon</option>
            <option value="paper">Paper</option>
            <option value="midnight">Midnight</option>
          </select>
        </label>

        <label class="preference-control">
          <span>Font</span>
          <select
            :value="fontChoice"
            aria-label="Editor font"
            @change="changeFont"
          >
            <option value="jetbrains">JetBrains Mono</option>
            <option value="ibm-plex">IBM Plex Mono</option>
            <option value="source-code">Source Code Pro</option>
            <option value="fira-code">Fira Code</option>
            <option value="system">System Mono</option>
          </select>
        </label>

        <div class="storage-note">
          <span class="storage-dot" aria-hidden="true" />
          Stored only in this browser
        </div>

        <a
          class="developer-mark"
          href="https://shuhanmirza.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          // built by shuhan
        </a>
      </footer>
    </aside>

    <main class="workspace">
      <template v-if="isReady && activeDocument">
        <header class="toolbar">
          <button
            class="menu-button"
            type="button"
            aria-label="Open document list"
            @click="isSidebarOpen = true"
          >
            <span />
            <span />
            <span />
          </button>

          <input
            class="title-input"
            :value="activeDocument.title"
            aria-label="Document name"
            autocomplete="off"
            spellcheck="false"
            @input="updateTitle"
          />

          <div class="toolbar-actions" aria-label="Document actions">
            <button
              class="action-button"
              :class="{
                'action-button--success': copyState === 'copied',
                'action-button--error': copyState === 'error',
              }"
              type="button"
              :aria-label="copyLabel"
              @click="copyDocument"
            >
              <span aria-hidden="true">⧉</span>
              <span class="action-label">{{ copyLabel }}</span>
            </button>
            <button
              class="action-button"
              type="button"
              aria-label="Download as a text file"
              @click="downloadDocument"
            >
              <span aria-hidden="true">↓</span>
              <span class="action-label">Download</span>
            </button>
          </div>

          <div class="toolbar-status" :class="{ 'status--error': saveState === 'error' }">
            <span class="status-dot" aria-hidden="true" />
            {{ saveLabel }}
          </div>
        </header>

        <textarea
          ref="editor"
          class="editor"
          :value="activeDocument.content"
          aria-label="Document text"
          autocomplete="off"
          autocapitalize="sentences"
          placeholder="Start typing…"
          spellcheck="true"
          @input="updateContent"
          @keydown="handleEditorKeydown"
        />

        <footer class="status-bar">
          <div class="document-stats" aria-label="Document statistics">
            <span>{{ stats.words }} {{ stats.words === 1 ? 'word' : 'words' }}</span>
            <span>{{ stats.characters }} chars</span>
            <span>{{ stats.lines }} {{ stats.lines === 1 ? 'line' : 'lines' }}</span>
          </div>

          <div class="sync-status" :class="{ 'sync-status--active': openTabCount > 1 }">
            <span class="sync-icon" aria-hidden="true">↔</span>
            {{ tabLabel }}
          </div>
        </footer>
      </template>

      <div v-else class="loading-state">
        <span />
        Loading your documents…
      </div>
    </main>
  </div>
</template>
