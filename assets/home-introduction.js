(() => {
  document.querySelectorAll('#academy-introduction video, #website-welcome video').forEach((video) => {
    const source = video.querySelector('source');
    if (!source) return;
    const src = source.getAttribute('src');
    if (!src) return;

    // Prime the opening fragments immediately so Play does not wait to fetch
    // the manifest and initial video segment.
    video.preload = 'auto';
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.load();
      return;
    }
    if (!window.Hls || !window.Hls.isSupported()) return;
    const hls = new window.Hls({
      autoStartLoad: true,
      startFragPrefetch: true,
      maxBufferLength: 18,
      maxMaxBufferLength: 30
    });
    hls.on(window.Hls.Events.MEDIA_ATTACHED, () => hls.loadSource(src));
    hls.attachMedia(video);
  });
})();

