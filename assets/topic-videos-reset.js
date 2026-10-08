(() => {
  document.querySelectorAll('video.topic-video[data-hls]').forEach((video) => {
    // Each film includes its own closing-card hold.
    // Return to its opening card, paused, once that closing finishes.
    video.addEventListener('ended', () => {
      video.pause();
      video.currentTime = 0;
    });
    const source = video.dataset.hls;
    const message = video.nextElementSibling;
    if (video.canPlayType('application/vnd.apple.mpegurl')) return;
    if (!window.Hls || !window.Hls.isSupported()) {
      message.hidden = false;
      return;
    }
    const hls = new window.Hls({ autoStartLoad: video.preload === 'auto' });
    hls.loadSource(source);
    hls.attachMedia(video);
    video.addEventListener('play', () => hls.startLoad(), { once: true });
    hls.on(window.Hls.Events.ERROR, (_, data) => {
      if (data.fatal) message.hidden = false;
    });
    video.addEventListener('playing', () => { message.hidden = true; });
  });
})();
