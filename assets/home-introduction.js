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
      if (video.closest('#academy-introduction')) {
        video.addEventListener('ended', () => video.load());
      }
      video.load();
      return;
    }
    if (!window.Hls || !window.Hls.isSupported()) return;
    const options = {
      autoStartLoad: true,
      startFragPrefetch: true,
      maxBufferLength: 18,
      maxMaxBufferLength: 30
    };
    let hls;
    const attachStream = () => {
      hls = new window.Hls(options);
      hls.on(window.Hls.Events.MEDIA_ATTACHED, () => hls.loadSource(src));
      hls.attachMedia(video);
    };
    if (video.closest('#academy-introduction')) {
      video.addEventListener('ended', () => {
        hls.destroy();
        video.load();
        attachStream();
      });
    }
    attachStream();
  });
})();

