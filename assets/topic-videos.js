(() => {
  document.querySelectorAll('video.topic-video[data-hls]').forEach((video) => {
    const source = video.dataset.hls;
    const message = video.nextElementSibling;
    if (video.canPlayType('application/vnd.apple.mpegurl')) return;
    if (!window.Hls || !window.Hls.isSupported()) {
      message.hidden = false;
      return;
    }
    const hls = new window.Hls({ autoStartLoad: false });
    hls.loadSource(source);
    hls.attachMedia(video);
    video.addEventListener('play', () => hls.startLoad(), { once: true });
    hls.on(window.Hls.Events.ERROR, (_, data) => {
      if (data.fatal) message.hidden = false;
    });
    video.addEventListener('playing', () => { message.hidden = true; });
  });
})();
