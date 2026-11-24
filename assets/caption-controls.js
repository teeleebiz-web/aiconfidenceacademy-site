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

const icon = (name, paths) => `<svg class="aca-icon-${name}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8">${paths}</svg>`;
const slider = (kind) => `<media-${kind}-slider class="aca-${kind}-slider"><media-slider-track><media-slider-buffer></media-slider-buffer><media-slider-fill></media-slider-fill></media-slider-track><media-slider-thumb></media-slider-thumb></media-${kind}-slider>`;
export const playbackBarMarkup = `
  <div class="aca-playback-bar" role="group" aria-label="Video controls">
    <media-play-button class="aca-player-button" title="Play or pause">
      ${icon('play', '<path d="m8 5 11 7-11 7Z" fill="currentColor" stroke="none"/>')}
      ${icon('pause', '<path d="M8 5v14M16 5v14" stroke-width="4"/>')}
    </media-play-button>
    ${slider('time')}
    <span class="aca-player-time"><media-time type="current"></media-time><span class="aca-player-duration"> / <media-time type="duration"></media-time></span></span>
    <media-mute-button class="aca-player-button" title="Mute or unmute">
      ${icon('sound', '<path d="M4 9h4l5-4v14l-5-4H4Z"/><path d="M17 8a6 6 0 0 1 0 8M20 5a10 10 0 0 1 0 14"/>')}
      ${icon('muted', '<path d="M4 9h4l5-4v14l-5-4H4ZM17 9l5 6m0-6-5 6"/>')}
    </media-mute-button>
    ${slider('volume')}
    <button type="button" class="aca-player-button aca-caption-button" hidden><span aria-hidden="true">CC</span></button>
    <details class="aca-playback-options">
      <summary class="aca-player-button" aria-label="Playback options" title="Playback options">${icon('options', '<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>')}</summary>
      <div class="aca-playback-menu">
        <label>Playback speed <select aria-label="Playback speed"><option value="0.5">0.5×</option><option value="0.75">0.75×</option><option value="1" selected>Normal</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option><option value="2">2×</option></select></label>
        <media-pip-button class="aca-pip-button">Picture in picture</media-pip-button>
      </div>
    </details>
    <media-fullscreen-button class="aca-player-button" title="Fullscreen">${icon('fullscreen', '<path d="M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5"/>')}</media-fullscreen-button>
  </div>`;
let uiPromise;
function loadPlayerUI() { return uiPromise ??= import('./vendor/aca-media-ui-10.6.0.js'); }

/** Enhance the existing video only after the accessible controls load. */
export function mountPlaybackControls(video, host, loadUI = loadPlayerUI) {
  let disposed = false;
  const originalControls = video.controls;
  const originalTabIndex = video.getAttribute('tabindex');
  const listeners = [];
  const listen = (target, type, handler) => { target.addEventListener(type, handler); listeners.push(() => target.removeEventListener(type, handler)); };
  host.hidden = true;
  host.innerHTML = playbackBarMarkup;
  const cc = host.querySelector('.aca-caption-button');
  cc.setAttribute('aria-controls', video.id);
  const captions = bindCaptionControl(video, state => {
    cc.hidden = !state.available;
    cc.disabled = !state.enabled || state.failed;
    cc.setAttribute('aria-pressed', String(state.on));
    cc.setAttribute('aria-label', state.failed ? 'Captions unavailable' : `Turn captions ${state.on ? 'off' : 'on'}`);
    cc.title = state.failed ? 'Please refresh to try loading captions again.' : `Captions ${state.on ? 'on' : 'off'}`;
  });
  listen(cc, 'click', captions.toggle);
  const speed = host.querySelector('select');
  listen(speed, 'change', () => { video.playbackRate = Number(speed.value); });
  listen(video, 'ratechange', () => { speed.value = String(video.playbackRate); });
  const options = host.querySelector('details');
  listen(options, 'keydown', event => { if (event.key === 'Escape') { options.open = false; options.querySelector('summary').focus(); } });
  const play = () => { if (video.paused) void video.play().catch(() => {}); else video.pause(); };
  const ready = loadUI().then(() => {
    if (disposed || !video.isConnected) return;
    if (!customElements.get('media-play-button') || !customElements.get('media-container')) throw new Error('Player controls unavailable');
    host.hidden = false;
    video.controls = false;
    video.tabIndex = 0;
    listen(video, 'click', play);
    listen(video, 'keydown', event => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === ' ' || event.key.toLowerCase() === 'k') { event.preventDefault(); play(); }
      else if (event.key.toLowerCase() === 'c' && !cc.hidden && !cc.disabled) { event.preventDefault(); captions.toggle(); }
      else if (event.key.toLowerCase() === 'm') { event.preventDefault(); video.muted = !video.muted; }
      else if (['ArrowLeft', 'ArrowRight'].includes(event.key) && Number.isFinite(video.duration)) {
        event.preventDefault(); video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + (event.key === 'ArrowLeft' ? -5 : 5)));
      }
    });
  }).catch(() => { if (!disposed) { host.hidden = true; video.controls = originalControls; } });
  return { ready, destroy() {
    disposed = true;
    captions.destroy();
    listeners.forEach(remove => remove());
    host.replaceChildren();
    video.controls = originalControls;
    if (originalTabIndex === null) video.removeAttribute('tabindex'); else video.setAttribute('tabindex', originalTabIndex);
  } };
}

(typeof document === 'undefined' ? [] : document.querySelectorAll('video[data-aca-caption-player]')).forEach((video, index) => {
  if (!video.id) video.id = `aca-caption-video-${index + 1}`;
  const player = document.createElement('video-player');
  player.className = 'aca-video-player';
  const frame = document.createElement('media-container');
  frame.className = 'aca-player-frame';
  const host = document.createElement('div');
  host.className = 'aca-player-controls';
  video.before(player);
  player.append(frame);
  frame.append(video, host);
  mountPlaybackControls(video, host);
});
