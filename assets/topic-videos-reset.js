(() => {
  document.querySelectorAll('main video[poster]').forEach((video) => {
    const source = video.dataset.hls;
    let hls;

    function attachStream() {
      hls = new window.Hls({ autoStartLoad: video.preload === 'auto' });
      hls.on(window.Hls.Events.ERROR, (_, data) => {
        if (data.fatal) video.nextElementSibling.hidden = false;
      });
      hls.loadSource(source);
      hls.attachMedia(video);
    }

    video.addEventListener('ended', () => {
      // Reloading restores the poster. Seeking to zero shows a video frame.
      if (hls) {
        hls.destroy();
        video.load();
        attachStream();
      } else {
        video.load();
      }
    });

    if (!source || video.canPlayType('application/vnd.apple.mpegurl')) return;
    const message = video.nextElementSibling;
    if (!window.Hls || !window.Hls.isSupported()) {
      message.hidden = false;
      return;
    }

    video.addEventListener('play', () => hls.startLoad());
    video.addEventListener('playing', () => { message.hidden = true; });
    attachStream();
  });
})();
