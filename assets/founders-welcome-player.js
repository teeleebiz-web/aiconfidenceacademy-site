(() => {
  document.querySelectorAll('#academy-introduction video, #website-welcome video').forEach((video) => {
    if (video.dataset.resetToOpening === 'true') {
      let resetScheduled = false;
      const scheduleReset = () => {
        if (resetScheduled) return;
        resetScheduled = true;
        video.pause();
        window.setTimeout(() => {
video.currentTime = 0;
resetScheduled = false;
        }, 1000);
      };
      video.addEventListener('ended', scheduleReset);
      video.addEventListener('timeupdate', () => {
        if (!video.paused && Number.isFinite(video.duration) && video.duration > 0 && video.currentTime >= video.duration - 0.03) {
scheduleReset();
        }
      });
    }
    if (video.canPlayType('application/vnd.apple.mpegurl')) return;
    if (!window.Hls || !window.Hls.isSupported()) return;
    const source = video.querySelector('source').getAttribute('src');
    const hls = new window.Hls({ autoStartLoad: false, maxBufferLength: 30 });
    hls.loadSource(source);
    hls.attachMedia(video);
    video.addEventListener('play', () => hls.startLoad(), { once: true });
  });
})();
