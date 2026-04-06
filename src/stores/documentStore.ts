// ============================================================
// Store documents
// ============================================================

import { create } from 'zustand'
import type { Document } from '@/types'

interface DocumentStore {
  documents: Document[]
  loading: boolean
  setDocuments: (docs: Document[]) => void
  addDocument: (doc: Document) => void
  updateDocument: (id: string, updates: Partial<Document>) => void
  setLoading: (loading: boolean) => void
}

export const useDocumentStore = create<DocumentStore>(set => ({
  documents: [],
  loading: false,
  setDocuments: (documents) => set({ documents }),
  addDocument: (doc) => set(state => ({ documents: [doc, ...state.documents] })),
  updateDocument: (id, updates) => set(state => ({
    documents: state.documents.map(d => d.id === id ? { ...d, ...updates } : d),
  })),
  setLoading: (loading) => set({ loading }),
}))

// ============================================================
// Store notifications (toasts)
// ============================================================

interface Toast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
}

interface NotificationStore {
  toasts: Toast[]
  addToast: (type: Toast['type'], message: string) => void
  removeToast: (id: string) => void
}

export const useNotificationStore = create<NotificationStore>(set => ({
  toasts: [],
  addToast: (type, message) => {
    const id = crypto.randomUUID()
    set(state => ({ toasts: [...state.toasts, { id, type, message }] }))
    // Auto-suppression après 4 secondes
    setTimeout(() => {
      set(state => ({ toasts: state.toasts.filter(t => t.id !== id) }))
    }, 4000)
  },
  removeToast: (id) => set(state => ({ toasts: state.toasts.filter(t => t.id !== id) })),
}))
