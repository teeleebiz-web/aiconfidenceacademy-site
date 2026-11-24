export type CaptionState = { available: boolean; enabled: boolean; on: boolean; failed: boolean }
export function bindCaptionControl(video: HTMLVideoElement, render: (state: CaptionState) => void): { toggle: () => void; destroy: () => void }
export const playbackBarMarkup: string
export function mountPlaybackControls(video: HTMLVideoElement, host: HTMLElement, loadUI?: () => Promise<unknown>): { ready: Promise<void>; destroy: () => void }
