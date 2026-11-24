import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from 'react'
import type { ComponentPropsWithoutRef } from 'react'
import { bindCaptionControl, captionButtonText } from '../assets/caption-controls.js'
import type { CaptionState } from '../assets/caption-controls.js'
import '../assets/caption-controls.css'

/** Preserve the native player and expose its captions through a visible control. */
export const CaptionedVideo = forwardRef<HTMLVideoElement, ComponentPropsWithoutRef<'video'>>(
  function CaptionedVideo({ children, id, ...props }, forwardedRef) {
    const generatedId = useId()
    const videoId = id ?? `aca-video-${generatedId}`
    const video = useRef<HTMLVideoElement>(null)
    const controller = useRef<ReturnType<typeof bindCaptionControl> | null>(null)
    const [state, setState] = useState<CaptionState>({ available: false, enabled: false, on: false, failed: false })
    useImperativeHandle(forwardedRef, () => video.current!, [])
    useEffect(() => {
      controller.current = bindCaptionControl(video.current!, setState)
      return () => { controller.current?.destroy(); controller.current = null }
    }, [])
    return <>
      <video {...props} id={videoId} ref={video}>{children}</video>
      <div className="aca-caption-controls" hidden={!state.available}>
        <button type="button" className="aca-caption-button" aria-controls={videoId}
          aria-pressed={state.on} disabled={!state.enabled || state.failed}
          title={state.failed ? 'Please refresh to try loading captions again.' : `Turn English captions ${state.on ? 'off' : 'on'}`}
          onClick={() => controller.current?.toggle()}>{captionButtonText(state)}</button>
      </div>
    </>
  },
)
