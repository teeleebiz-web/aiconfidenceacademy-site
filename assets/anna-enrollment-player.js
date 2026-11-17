(() => {
  const video = document.querySelector('#anna-enrollment-orientation video');
  if (!video) return;

  let resetTimer = null;
  video.addEventListener('ended', () => {
    if (resetTimer !== null) return;
    resetTimer = window.setTimeout(() => {
      video.pause();
      video.currentTime = 0;
      resetTimer = null;
    }, 1800);
  });
  video.addEventListener('seeking', () => {
    if (resetTimer !== null) {
      window.clearTimeout(resetTimer);
      resetTimer = null;
    }
  });

  // Prefer the standard MP4 on phones and other compatible devices.
  video.preload = 'auto';
  if (video.canPlayType('video/mp4')) {
    video.load();
    return;
  }
  // Original HLS remains as fallback for devices without MP4 support.
  const hlsSource = video.querySelector('source[type="application/vnd.apple.mpegurl"]');
  const src = hlsSource?.getAttribute('src');
  if (!src) return;
  if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.load();
    return;
  }
  if (!window.Hls || !window.Hls.isSupported()) return;
  const hls = new window.Hls({
    autoStartLoad: true,
    startFragPrefetch: true,
    maxBufferLength: 24,
    maxMaxBufferLength: 32
  });
  hls.on(window.Hls.Events.MEDIA_ATTACHED, () => hls.loadSource(src));
  hls.attachMedia(video);
})();
