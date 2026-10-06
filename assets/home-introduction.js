(() => {
  document.querySelectorAll('#academy-introduction video, #website-welcome video').forEach((video) => {
    if (video.canPlayType('application/vnd.apple.mpegurl')) return;
    if (!window.Hls || !window.Hls.isSupported()) return;
    const source = video.querySelector('source').getAttribute('src');
    const hls = new window.Hls({ autoStartLoad: false, maxBufferLength: 30 });
    hls.loadSource(source);
    hls.attachMedia(video);
    video.addEventListener('play', () => hls.startLoad(), { once: true });
  });
})();
