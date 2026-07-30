import {
  SYNC_CHANNEL_NAME,
  SYNC_FALLBACK_STORAGE_KEY,
} from './config'
import type { SyncMessage, TextDocument } from './types'

const HEARTBEAT_INTERVAL = 4_000
const PEER_TIMEOUT = 12_000

type MessageListener = (message: SyncMessage) => void
type PresenceListener = () => void

interface Peer {
  documentId: string | null
  lastSeen: number
}

export class DocumentSync {
  readonly tabId = crypto.randomUUID()

  private activeDocumentId: string | null = null
  private channel: BroadcastChannel | null = null
  private peers = new Map<string, Peer>()
  private messageListeners = new Set<MessageListener>()
  private presenceListeners = new Set<PresenceListener>()
  private heartbeat: number

  constructor() {
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(SYNC_CHANNEL_NAME)
      this.channel.addEventListener('message', (event: MessageEvent<SyncMessage>) => {
        this.receive(event.data)
      })
    } else {
      window.addEventListener('storage', this.receiveStorageEvent)
    }

    window.addEventListener('pagehide', this.close)
    this.heartbeat = window.setInterval(() => {
      this.prunePeers()
      this.announce('presence')
    }, HEARTBEAT_INTERVAL)

    this.announce('hello')
  }

  onMessage(listener: MessageListener) {
    this.messageListeners.add(listener)
    return () => this.messageListeners.delete(listener)
  }

  onPresenceChange(listener: PresenceListener) {
    this.presenceListeners.add(listener)
    return () => this.presenceListeners.delete(listener)
  }

  setActiveDocument(documentId: string | null) {
    this.activeDocumentId = documentId
    this.announce('presence')
    this.notifyPresenceListeners()
  }

  countTabsFor(documentId: string) {
    this.prunePeers()
    let count = this.activeDocumentId === documentId ? 1 : 0

    for (const peer of this.peers.values()) {
      if (peer.documentId === documentId) count += 1
    }

    return count
  }

  publishDocument(document: TextDocument) {
    this.send({
      type: 'document:update',
      tabId: this.tabId,
      document,
      sentAt: Date.now(),
    })
  }

  publishDeletion(documentId: string) {
    this.send({
      type: 'document:delete',
      tabId: this.tabId,
      documentId,
      sentAt: Date.now(),
    })
  }

  private announce(type: 'hello' | 'presence' | 'bye') {
    this.send({
      type,
      tabId: this.tabId,
      documentId: this.activeDocumentId,
      sentAt: Date.now(),
    })
  }

  private send(message: SyncMessage) {
    if (this.channel) {
      this.channel.postMessage(message)
      return
    }

    localStorage.setItem(
      SYNC_FALLBACK_STORAGE_KEY,
      JSON.stringify({ ...message, nonce: crypto.randomUUID() }),
    )
  }

  private receiveStorageEvent = (event: StorageEvent) => {
    if (event.key !== SYNC_FALLBACK_STORAGE_KEY || !event.newValue) return

    try {
      this.receive(JSON.parse(event.newValue) as SyncMessage)
    } catch {
      // Ignore unrelated or malformed localStorage data.
    }
  }

  private receive(message: SyncMessage) {
    if (!message || message.tabId === this.tabId) return

    if (
      message.type === 'hello' ||
      message.type === 'presence' ||
      message.type === 'bye'
    ) {
      if (message.type === 'bye') {
        this.peers.delete(message.tabId)
      } else {
        this.peers.set(message.tabId, {
          documentId: message.documentId,
          lastSeen: Date.now(),
        })

        if (message.type === 'hello') this.announce('presence')
      }

      this.notifyPresenceListeners()
      return
    }

    this.messageListeners.forEach((listener) => listener(message))
  }

  private prunePeers() {
    const oldestAllowed = Date.now() - PEER_TIMEOUT
    let changed = false

    for (const [tabId, peer] of this.peers) {
      if (peer.lastSeen < oldestAllowed) {
        this.peers.delete(tabId)
        changed = true
      }
    }

    if (changed) this.notifyPresenceListeners()
  }

  private notifyPresenceListeners() {
    this.presenceListeners.forEach((listener) => listener())
  }

  private close = () => {
    this.announce('bye')
    window.clearInterval(this.heartbeat)
    this.channel?.close()
    window.removeEventListener('storage', this.receiveStorageEvent)
    window.removeEventListener('pagehide', this.close)
  }
}
