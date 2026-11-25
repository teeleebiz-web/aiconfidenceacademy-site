// The selected poster is the opening card. Start directly in the approved film.
document.querySelectorAll('.founder-film').forEach(frame => {
  const video = frame.querySelector('video');
  const start = frame.querySelector('.founder-start');
  if (!video || !start) return;
  start.hidden = false;
  start.addEventListener('click', () => {
    start.hidden = true;
    video.play().then(() => video.focus({ preventScroll: true })).catch(() => { start.hidden = false; });
  });
  video.addEventListener('play', () => { start.hidden = true; });
  // topic-videos-reset restores the same poster after the film ends.
  video.addEventListener('ended', () => { start.hidden = false; });
});
