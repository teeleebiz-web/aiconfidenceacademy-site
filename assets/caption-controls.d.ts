export type CaptionState = { available: boolean; enabled: boolean; on: boolean; failed: boolean }
export function bindCaptionControl(video: HTMLVideoElement, render: (state: CaptionState) => void): { toggle: () => void; destroy: () => void }
export function captionButtonText(state: CaptionState): string
