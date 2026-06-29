// Types ambient de la couche UI : pont IPC exposé par electron/preload.js + assets.
import type { WorkerInMsg, WorkerOutMsg } from '../../../engine/protocol'

export interface CaptureRect {
  x: number
  y: number
  width: number
  height: number
}

declare global {
  interface Window {
    engine?: {
      send: (msg: WorkerInMsg) => void
      onMessage: (callback: (msg: WorkerOutMsg) => void) => void
    }
    capture?: {
      map: (rect: CaptureRect, defaultName?: string) => Promise<{ ok: boolean; filePath?: string }>
    }
  }
}

// Imports CSS en effet de bord (gérés par Vite).
declare module '*.css'

export {}
