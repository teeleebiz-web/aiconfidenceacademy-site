// One caption controller shared by the public pages and React players.
export function bindCaptionControl(video, render) {
  const tracks = () => Array.from(video.textTracks).filter(track =>
    track.kind === 'captions' || track.kind === 'subtitles');
  let choice = null;
  const sync = () => {
    const elements = Array.from(video.querySelectorAll('track[kind="captions"], track[kind="subtitles"]'));
    const available = tracks();
    render({
      available: elements.length > 0,
      enabled: available.length > 0,
      on: available.some(track => track.mode === 'showing'),
      failed: elements.length > 0 && elements.every(track => track.readyState === 3),
    });
  };
  const apply = () => {
    const available = tracks();
    const english = available.find(track => track.language === 'en') || available[0];
    available.forEach(track => { track.mode = choice && track === english ? 'showing' : 'disabled'; });
  };
  const changed = () => {
    if (tracks().length) choice = tracks().some(track => track.mode === 'showing');
    sync();
  };
  const added = () => { if (choice !== null) apply(); sync(); };
  const observer = new MutationObserver(added);
  observer.observe(video, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'kind', 'default'] });
  video.textTracks.addEventListener?.('change', changed);
  video.textTracks.addEventListener?.('addtrack', added);
  video.textTracks.addEventListener?.('removetrack', sync);
  video.addEventListener('loadedmetadata', sync);
  video.addEventListener('load', sync, true);
  video.addEventListener('error', sync, true);
  sync();
  return {
    toggle() {
      choice = !tracks().some(track => track.mode === 'showing');
      apply();
      sync();
    },
    destroy() {
      observer.disconnect();
      video.textTracks.removeEventListener?.('change', changed);
      video.textTracks.removeEventListener?.('addtrack', added);
      video.textTracks.removeEventListener?.('removetrack', sync);
      video.removeEventListener('loadedmetadata', sync);
      video.removeEventListener('load', sync, true);
      video.removeEventListener('error', sync, true);
    },
  };
}

export function captionButtonText(state) {
  return `CC · Captions ${state.failed ? 'unavailable' : state.on ? 'on' : 'off'}`;
}

// Static public pages opt in explicitly; React owns its own button lifecycle.
(typeof document === 'undefined' ? [] : document.querySelectorAll('video[data-aca-caption-player]')).forEach((video, index) => {
  if (!video.id) video.id = `aca-caption-video-${index + 1}`;
  const row = document.createElement('div');
  row.className = 'aca-caption-controls';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'aca-caption-button';
  button.setAttribute('aria-controls', video.id);
  row.append(button);
  // The existing Video Library player keeps its playback error immediately
  // after the video. Preserve that relationship when adding the visible control.
  const message = video.nextElementSibling;
  if (message?.classList.contains('topic-video-error')) message.after(row);
  else video.after(row);
  const controller = bindCaptionControl(video, state => {
    row.hidden = !state.available;
    button.textContent = captionButtonText(state);
    button.setAttribute('aria-pressed', String(state.on));
    button.disabled = !state.enabled || state.failed;
    button.title = state.failed ? 'Please refresh to try loading captions again.' : `Turn English captions ${state.on ? 'off' : 'on'}`;
  });
  button.addEventListener('click', controller.toggle);
});
