"""Render ACA seals into the six presenter films from their published streams."""
import json
import re
import subprocess
import tempfile
from pathlib import Path


def run(*args):
    subprocess.run(args, check=True)


root = Path('assets/video-library-branded')
page = Path('videos/index.html').read_text()
for match in re.finditer(r'<video\b[^>]+poster="/assets/video-library-covers/([\w-]+)\.webp"[^>]+data-hls="/assets/videos/([\w-]+)/film\.m3u8"', page):
    slug, original = match.groups()
    source = Path('assets/videos') / original
    target = root / slug
    target.mkdir(parents=True, exist_ok=True)
    playlist = (source / 'film.m3u8').read_text()
    init = re.search(r'#EXT-X-MAP:URI="([^"]+)"', playlist)[1]
    parts = [line for line in playlist.splitlines() if line and not line.startswith('#')]
    with tempfile.TemporaryDirectory() as work:
        media = Path(work) / 'source.mp4'
        with media.open('wb') as file:
            for part in [init, *parts]:
                file.write((source / part).read_bytes())
        run(
            'ffmpeg', '-nostdin', '-v', 'error', '-xerror', '-y', '-i', str(media),
            '-i', 'aca-official-seal.png', '-filter_complex',
            '[1:v]scale=104:104[seal];[0:v][seal]overlay=32:28,format=yuv420p[out]',
            '-map', '[out]', '-map', '0:a:0', '-af', 'aresample=async=1:first_pts=0',
            '-c:v', 'libx264', '-preset', 'fast', '-crf', '21', '-threads', '4',
            '-force_key_frames', 'expr:gte(t,n_forced*6)', '-c:a', 'aac', '-b:a', '128k',
            '-hls_time', '6', '-hls_segment_type', 'fmp4', '-hls_playlist_type', 'vod',
            '-hls_flags', 'independent_segments', '-hls_segment_filename', str(target / 'part%03d.m4s'),
            str(target / 'film.m3u8'),
        )
        def duration(path):
            return float(json.loads(subprocess.check_output([
                'ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'json', str(path)
            ]))['format']['duration'])
        assert abs(duration(target / 'film.m3u8') - duration(media)) < 0.2, slug
        print(f'{slug}: rendered and checked duration', flush=True)
assert len(list(root.glob('*/film.m3u8'))) == 6
