import { createElement, forwardRef, useEffect, useId, useImperativeHandle, useRef } from 'react'
import type { ComponentPropsWithoutRef } from 'react'
import { mountPlaybackControls, mountVideoSeal, bindCaptionControl } from '../assets/caption-controls.js'
import '../assets/caption-controls.css'

/** The original media element, with CC integrated into its playback bar. */
export const CaptionedVideo = forwardRef<HTMLVideoElement, ComponentPropsWithoutRef<'video'>>(
  function CaptionedVideo({ children, id, ...props }, forwardedRef) {
    const generatedId = useId()
    const video = useRef<HTMLVideoElement>(null)
    const controls = useRef<HTMLDivElement>(null)
    useImperativeHandle(forwardedRef, () => video.current!, [])
    useEffect(() => {
      const controller = mountPlaybackControls(video.current!, controls.current!)
      return () => controller.destroy()
    }, [])
    return createElement('video-player', { className: 'aca-video-player aca-curriculum-player' },
      createElement('media-container', { className: 'aca-player-frame' },
        <video {...props} id={id ?? `aca-video-${generatedId}`} ref={video}>{children}</video>,
        <div className="aca-player-controls" ref={controls} hidden />,
      ),
    )
  },
)

/** Owner inspection keeps its original native player; no custom CC is added. */
export function InspectionVideo({ src, captions }: { src: string; captions?: string }) {
  const video = useRef<HTMLVideoElement>(null)
  const frame = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const seal = mountVideoSeal(video.current!, frame.current!)
    const captions = bindCaptionControl(video.current!, () => {})
    return () => { seal.destroy(); captions.destroy() }
  }, [src])
  return <div className="aca-player-frame" ref={frame}>
    <video ref={video} controls crossOrigin="anonymous" preload="metadata" src={src}>
      {captions ? <track kind="captions" src={captions} srcLang="en" label="English" default /> : null}
    </video>
  </div>
}
