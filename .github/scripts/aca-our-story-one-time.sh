#!/usr/bin/env bash
set -euo pipefail
SOURCE="assets/videos/founders-shared-welcome"
TMP="$(mktemp -d)"
mkdir -p "$TMP/hls"
test "$(git hash-object "$SOURCE/film.m3u8")" = "2373ce3dbb12c19cbad74b7c2c51bb44c085e841"
curl --fail --location --silent --show-error --retry 3 "$RECREATED_FOUNDER_URL" -o "$TMP/founder.mp4"
python3 - "$SOURCE" "$TMP/founder.mp4" <<'PY'
import pathlib,sys,re,json,subprocess
p=pathlib.Path(sys.argv[1]); movie=pathlib.Path(sys.argv[2])
t=(p/'film.m3u8').read_text()
d=[float(x) for x in re.findall(r'#EXTINF:([0-9.]+)',t)]
assert len(d)==32 and abs(sum(d)-309)<0.1 and abs(sum(d[:17])-169.12)<0.1
info=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','stream=codec_type,width,height:format=duration','-of','json',str(movie)]))
assert abs(float(info['format']['duration'])-166.491)<.25
assert any(s.get('codec_type')=='audio' for s in info['streams'])
assert any(s.get('codec_type')=='video' and s.get('width')==1920 and s.get('height')==1080 for s in info['streams'])
for n in ['part17.m4s','part18.m4s','part30.m4s','part31.m4s','poster.webp']:
    assert (p/n).exists()
print('Approved source verified: 3s opening, 166.12s old founder, 137.88s Jeff and 2s ending')
PY
ffmpeg -v error -xerror -i "$SOURCE/film.m3u8" -f null -
cat > "$TMP/film-filter.txt" <<'FILTER'
[0:v]split=3[open][jeff][ending];
[0:a]asplit=3[opena][jeffa][endinga];
[open]trim=start=0:end=3,setpts=PTS-STARTPTS,fps=25,scale=1280:720,setsar=1,format=yuv420p[v0];
[opena]atrim=start=0:end=3,asetpts=PTS-STARTPTS,aresample=48000:async=1[a0];
[1:v]setpts=PTS-STARTPTS,fps=25,scale=1280:720,setsar=1,format=yuv420p[v1];
[1:a]asetpts=PTS-STARTPTS,aresample=48000:async=1[a1];
[jeff]trim=start=169.12:end=307,setpts=PTS-STARTPTS,fps=25,scale=1280:720,setsar=1,format=yuv420p[v2];
[jeffa]atrim=start=169.12:end=307,asetpts=PTS-STARTPTS,aresample=48000:async=1[a2];
[ending]trim=start=307:end=309,setpts=PTS-STARTPTS,fps=25,scale=1280:720,setsar=1,format=yuv420p[v3];
[endinga]atrim=start=307:end=309,asetpts=PTS-STARTPTS,aresample=48000:async=1[a3];
[v0][a0][v1][a1][v2][a2][v3][a3]concat=n=4:v=1:a=1[v][a]
FILTER
KEYS="$(python3 - <<'PY'
print(','.join(map(str,[0,3]+list(range(11,321,8)))))
PY
)"
ffmpeg -hide_banner -loglevel error -xerror -i "$SOURCE/film.m3u8" -i "$TMP/founder.mp4" -filter_complex_script "$TMP/film-filter.txt" -map "[v]" -map "[a]" -c:v libx264 -preset veryfast -crf 18 -profile:v high -level:v 3.1 -pix_fmt yuv420p -r 25 -g 200 -keyint_min 25 -sc_threshold 0 -force_key_frames "$KEYS" -c:a aac -b:a 160k -ac 2 -ar 48000 -movflags +faststart -y "$TMP/film.mp4"
ffmpeg -hide_banner -loglevel error -i "$TMP/film.mp4" -c copy -f hls -hls_time 2.5 -hls_playlist_type vod -hls_segment_type fmp4 -hls_fmp4_init_filename "init-recreated-story.mp4" -hls_segment_filename "$TMP/hls/recreated-story-%03d.m4s" "$TMP/hls/film.m3u8"
ffmpeg -hide_banner -loglevel error -xerror -i "$TMP/hls/film.m3u8" -f null -
python3 - "$TMP/hls/film.m3u8" <<'PY'
import pathlib,re,sys
m=pathlib.Path(sys.argv[1]); t=m.read_text()
d=[float(x) for x in re.findall(r'#EXTINF:([0-9.]+)',t)]
f=[x for x in t.splitlines() if x.startswith('recreated-story-')]
assert t.startswith('#EXTM3U') and '#EXT-X-ENDLIST' in t
assert len(d)>=35 and len(d)==len(f) and 308.8<=sum(d)<=310.8,(len(d),sum(d))
assert 2.85<=d[0]<=3.15 and max(d)<=9
assert all((m.parent/x).exists() for x in f)
print(f'Film decoded: duration={sum(d):.2f}s; opening={d[0]:.2f}s; Jeff original presentation and closing retained.')
PY
cp "$TMP/hls/film.m3u8" "$SOURCE/film.m3u8"
cp "$TMP/hls/init-recreated-story.mp4" "$SOURCE/"
cp "$TMP/hls"/recreated-story-*.m4s "$SOURCE/"
git config user.name "ACA Our Story media replacement"
git config user.email "actions@users.noreply.github.com"
git add "$SOURCE/film.m3u8" "$SOURCE/init-recreated-story.mp4" "$SOURCE"/recreated-story-*.m4s
git rm .github/workflows/aca-our-story-recreated-avatar-once.yml .github/scripts/aca-our-story-one-time.sh
python3 - <<'PY'
import subprocess
files=subprocess.check_output(['git','diff','--cached','--name-only'],text=True).splitlines()
allow=lambda x: x in ['.github/workflows/aca-our-story-recreated-avatar-once.yml','.github/scripts/aca-our-story-one-time.sh','assets/videos/founders-shared-welcome/film.m3u8','assets/videos/founders-shared-welcome/init-recreated-story.mp4'] or x.startswith('assets/videos/founders-shared-welcome/recreated-story-')
assert files and all(map(allow,files)),files
print('Publication scope validated:',len(files),'files. No original Jeff, card, poster, player or webpage files changed.')
PY
git commit -m "Update Our Story with recreated founder avatar, preserving original Jeff and cards"
git push origin HEAD:main
echo "ACA_OUR_STORY_RECREATED_AVATAR_PUBLISHED=1"
