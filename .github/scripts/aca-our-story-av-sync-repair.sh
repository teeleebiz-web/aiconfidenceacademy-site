#!/usr/bin/env bash
set -euo pipefail
SOURCE="assets/videos/founders-shared-welcome"
TMP="$(mktemp -d)"
mkdir -p "$TMP/hls"
# No user-facing edit proceeds unless the source is the verified original film.
test "$(git hash-object "$SOURCE/film.m3u8")" = "2373ce3dbb12c19cbad74b7c2c51bb44c085e841"
curl --fail --location --silent --show-error --retry 3 --connect-timeout 20 "$RECREATED_FOUNDER_URL" -o "$TMP/founder.mp4"
cat "$SOURCE/init-open.mp4" "$SOURCE/part00.m4s" > "$TMP/original-opening.mp4"
cat "$SOURCE/init.mp4" "$SOURCE"/part{17..30}.m4s > "$TMP/jeff-original.mp4"
cat "$SOURCE/init-end.mp4" "$SOURCE/part31.m4s" > "$TMP/original-ending.mp4"
for scene in original-opening jeff-original original-ending; do
  ffmpeg -hide_banner -loglevel error -xerror -i "$TMP/$scene.mp4" -f null -
  echo "ACA_SOURCE_DECODES=$scene"
done
python3 - "$SOURCE" "$TMP/founder.mp4" "$TMP/jeff-original.mp4" <<'PY'
import pathlib,re,subprocess,sys,json
root=pathlib.Path(sys.argv[1])
manifest=(root/'film.m3u8').read_text()
dur=[float(s) for s in re.findall(r'#EXTINF:([0-9.]+)',manifest)]
assert len(dur)==32 and abs(sum(dur)-309.0)<.1 and abs(sum(dur[:17])-169.12)<.1
for f in ('part00.m4s','part17.m4s','part30.m4s','part31.m4s','poster.webp'):
    assert (root/f).exists(),f
def probe(p):
    return json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','stream=codec_type,width,height,start_time:format=duration,start_time','-of','json',str(p)],text=True))
founder=probe(sys.argv[2]); jeff=probe(sys.argv[3])
assert abs(float(founder['format']['duration'])-166.491)<.25
assert any(s.get('codec_type')=='audio' for s in founder['streams'])
assert any(s.get('codec_type')=='video' and s.get('width')==1920 and s.get('height')==1080 for s in founder['streams'])
video_start=float(next(x['start_time'] for x in jeff['streams'] if x['codec_type']=='video'))
audio_start=float(next(x['start_time'] for x in jeff['streams'] if x['codec_type']=='audio'))
assert abs(video_start-171.2)<.12 and abs(audio_start-171.123)<.12,(video_start,audio_start)
print(f'ACA_ROOT_CAUSE_GUARD: original Jeff A/V timestamps video={video_start:.3f}, audio={audio_start:.3f}; previous splice used incorrect 169.12s absolute trim. Founder approved source 166.491s.')
PY

# Crucial fix: rebuild from Jeff's original uninterrupted compressed picture AND
# its own original embedded audio, rather than independently trimming A/V from
# an HLS playlist containing timestamp discontinuities.
# The same 171.12s base is applied to BOTH Jeff tracks. Jeff source is isolated
# BEFORE any trimming, so the prior Terrence soundtrack cannot bleed into it.
cat > "$TMP/filter.txt" <<'FILTER'
[0:v]trim=start=0:end=3,setpts=PTS-STARTPTS,fps=25,scale=1280:720,setsar=1,format=yuv420p[v0];
[0:a]atrim=start=0:end=3,asetpts=PTS-STARTPTS,aresample=48000:async=1[a0];
[1:v]setpts=PTS-STARTPTS,fps=25,scale=1280:720,setsar=1,format=yuv420p[v1];
[1:a]asetpts=PTS-STARTPTS,aresample=48000:async=1[a1];
[2:v]setpts=PTS-(171.12/TB),trim=start=0:end=137.88,fps=25,scale=1280:720,setsar=1,format=yuv420p[v2];
[2:a]asetpts=PTS-(171.12/TB),atrim=start=0:end=137.88,aresample=48000:async=1[a2];
[3:v]setpts=PTS-(309.0/TB),trim=start=0:end=2.0,fps=25,scale=1280:720,setsar=1,format=yuv420p[v3];
[3:a]asetpts=PTS-(309.0/TB),atrim=start=0:end=2.0,aresample=48000:async=1[a3];
[v0][a0][v1][a1][v2][a2][v3][a3]concat=n=4:v=1:a=1[v][a]
FILTER
KEYS="$(python3 - <<'PY'
print(','.join(map(str,[0,3]+list(range(11,340,8)))))
PY
)"
ffmpeg -hide_banner -loglevel error -xerror \
  -i "$TMP/original-opening.mp4" -i "$TMP/founder.mp4" \
  -i "$TMP/jeff-original.mp4" -i "$TMP/original-ending.mp4" \
  -filter_complex_script "$TMP/filter.txt" -map "[v]" -map "[a]" \
  -c:v libx264 -preset veryfast -crf 18 -profile:v high -level:v 3.1 \
  -pix_fmt yuv420p -r 25 -g 200 -keyint_min 25 -sc_threshold 0 \
  -force_key_frames "$KEYS" \
  -c:a aac -b:a 160k -ar 48000 -ac 2 -movflags +faststart \
  -y "$TMP/corrected.mp4"
ffmpeg -hide_banner -loglevel error -xerror -i "$TMP/corrected.mp4" -f null -

# Verify Jeff's OWN original audio against the repaired output at early, middle
# and late points of his performance; this detects both voice bleed and drift.
ffmpeg -hide_banner -loglevel error -i "$TMP/jeff-original.mp4" \
  -map 0:a:0 -af "asetpts=PTS-(171.12/TB),atrim=start=0:end=137.88" \
  -ac 1 -ar 1000 -f s16le -y "$TMP/jeff-reference.s16"
ffmpeg -hide_banner -loglevel error -i "$TMP/corrected.mp4" \
  -map 0:a:0 -ac 1 -ar 1000 -f s16le -y "$TMP/final-audio.s16"
python3 - "$TMP/jeff-reference.s16" "$TMP/final-audio.s16" <<'PY'
import sys,array,math
r=array.array('h');r.frombytes(open(sys.argv[1],'rb').read())
n=array.array('h');n.frombytes(open(sys.argv[2],'rb').read())
assert 130000 < len(r) < 140000,len(r)
assert 305000 < len(n) < 315000,len(n)
# All three checkpoints must align within a tenth of a second and correlate
# strongly with the original unmodified Jeff soundtrack.
BASE=int(round((3+166.491)*1000))
for offset in (5,45,85,120):
    a=list(r[int(offset*1000):int(offset*1000)+5000:2])
    av=sum(a)/len(a);a=[x-av for x in a]; aa=sum(x*x for x in a)
    if aa<250000: continue
    best=(-2,None)
    for lag in range(-180,181,10):
        start=BASE+offset*1000+lag
        b=list(n[start:start+5000:2])
        if len(b)!=len(a):continue
        bv=sum(b)/len(b);b=[x-bv for x in b];bb=sum(y*y for y in b)
        if bb<250000:continue
        corr=sum(x*y for x,y in zip(a,b))/math.sqrt(aa*bb)
        if corr>best[0]:best=(corr,lag)
    print(f'ACA_JEFF_ORIGINAL_AUDIO_MATCH offset={offset}s correlation={best[0]:.3f} lag_ms={best[1]}')
    assert best[1] is not None and best[0]>0.65 and abs(best[1])<=100,('Jeff A/V alignment failed',offset,best)
print('ACA_JEFF_AUDIO_BOUNDARY_AND_DRIFT_CHECK_PASSED')
PY

ffmpeg -hide_banner -loglevel error -i "$TMP/corrected.mp4" -c copy \
  -f hls -hls_time 2.5 -hls_playlist_type vod -hls_segment_type fmp4 \
  -hls_fmp4_init_filename "init-av-fixed.mp4" \
  -hls_segment_filename "$TMP/hls/av-fixed-%03d.m4s" "$TMP/hls/film.m3u8"
ffmpeg -hide_banner -loglevel error -xerror -i "$TMP/hls/film.m3u8" -f null -
python3 - "$TMP/hls/film.m3u8" <<'PY'
import pathlib,re,sys
m=pathlib.Path(sys.argv[1]);s=m.read_text()
dur=[float(x) for x in re.findall(r'#EXTINF:([0-9.]+)',s)]
parts=re.findall(r'(av-fixed-[0-9]+\.m4s)',s)
assert s.startswith('#EXTM3U') and '#EXT-X-ENDLIST' in s
assert len(dur)>35 and len(dur)==len(parts)
assert 308.7<=sum(dur)<=310.5,(sum(dur),dur[:4])
assert 2.85<=dur[0]<=3.15,dur[:4]
assert all((m.parent/f).exists() for f in parts)
assert (m.parent/'init-av-fixed.mp4').exists()
print(f'ACA_FINAL_STREAM_DECODE_PASSED runtime={sum(dur):.3f}s parts={len(parts)} opening={dur[0]:.3f}s')
PY

# Only the Our Story HLS manifest and new media pieces are modified.
# Keep previous/backup source fragments, Jeff media, cards, poster, and all
# website code byte-for-byte unchanged.
cp "$TMP/hls/film.m3u8" "$SOURCE/film.m3u8"
cp "$TMP/hls/init-av-fixed.mp4" "$SOURCE/"
cp "$TMP/hls"/av-fixed-*.m4s "$SOURCE/"
git config user.name "ACA Our Story A/V repair"
git config user.email "actions@users.noreply.github.com"
git add "$SOURCE/film.m3u8" "$SOURCE/init-av-fixed.mp4" "$SOURCE"/av-fixed-*.m4s
git rm .github/scripts/aca-our-story-av-sync-repair.sh .github/workflows/aca-our-story-av-sync-repair-once.yml .github/workflows/aca-our-story-jeff-source-check-once.yml
python3 - <<'PY'
import subprocess
paths=subprocess.check_output(['git','diff','--cached','--name-only'],text=True).splitlines()
ok=lambda p:p in ('.github/scripts/aca-our-story-av-sync-repair.sh','.github/workflows/aca-our-story-av-sync-repair-once.yml','.github/workflows/aca-our-story-jeff-source-check-once.yml','assets/videos/founders-shared-welcome/film.m3u8','assets/videos/founders-shared-welcome/init-av-fixed.mp4') or p.startswith('assets/videos/founders-shared-welcome/av-fixed-')
assert paths and all(map(ok,paths)),paths
print('ACA_SCOPE_AUDIT_PASSED: only Our Story stream and temporary backend repair files')
PY
git commit -m "Repair Our Story founder-to-Jeff handoff with Jeff original synchronized audio and video"
git push origin HEAD:main
echo "ACA_OUR_STORY_SYNC_REPAIR_COMMITTED"
