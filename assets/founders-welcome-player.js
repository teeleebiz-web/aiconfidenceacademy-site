(() => {
  document.querySelectorAll('#academy-introduction video, #website-welcome video').forEach((video) => {
    if (video.dataset.resetToOpening === 'true') {
      let preEndHoldDone = false;
      let finalHoldScheduled = false;

      const resetToOpening = () => {
        video.currentTime = 0;
        preEndHoldDone = false;
        finalHoldScheduled = false;
      };

      video.addEventListener('timeupdate', () => {
        if (!Number.isFinite(video.duration) || video.duration <= 0) return;

        const beforeCard = video.duration - 2.20;
        if (!preEndHoldDone && !video.paused && video.currentTime >= beforeCard && video.currentTime < video.duration - 1.95) {
          preEndHoldDone = true;
          video.pause();
          window.setTimeout(() => {
            video.play().catch(() => {});
          }, 1500);
          return;
        }

        if (!finalHoldScheduled && !video.paused && video.currentTime >= video.duration - 0.04) {
          finalHoldScheduled = true;
          video.pause();
          window.setTimeout(resetToOpening, 2000);
        }
      });

      video.addEventListener('ended', () => {
        if (finalHoldScheduled) return;
        finalHoldScheduled = true;
        window.setTimeout(resetToOpening, 2000);
      });

      video.addEventListener('seeking', () => {
        if (Number.isFinite(video.duration) && video.currentTime < video.duration - 3) {
          preEndHoldDone = false;
          finalHoldScheduled = false;
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
