#!/usr/bin/env python3
"""Reproduce Terrence's approved November 22 enrollment presentation correction.

Only the original opening-card subtitle and the transient branch are composited.
The first 24 frames, all 6,568 video-frame positions, and original AAC are retained.
Refuse a changed source; publish locally only after both encodes pass verification.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
MEDIA = ROOT / 'assets/videos/anna-enrollment'
MP4_SHA = '1e6946b3a241eef92294f0056ddef71a118b8c8671d5d111ee94439be6f83382'
HLS_SHA = '023800c199ca0e5f91926013d44deccd2cd1d23730c272c9e669116b1127661b'

def run(*args):
    subprocess.run([str(a) for a in args], check=True)

def ff(*args):
    run('ffmpeg', '-hide_banner', '-loglevel', 'error', '-nostdin', '-y', *args)

def probe(path):
    return json.loads(subprocess.check_output(['ffprobe', '-v', 'error',
        '-show_streams', '-show_format', '-of', 'json', str(path)]))

def audio_hash(path):
    data = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(path),
        '-map', '0:a:0', '-c:a', 'copy', '-f', 'adts', '-'])
    return hashlib.sha256(data).hexdigest()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    out = args.output.resolve()
    assert not out.exists(), 'Use a new output directory; originals are never overwritten.'
    assert hashlib.sha256((MEDIA/'film-mobile.mp4').read_bytes()).hexdigest() == MP4_SHA
    assert len(list(MEDIA.glob('part*.m4s'))) == 28
    with tempfile.TemporaryDirectory(prefix='aca-enrollment-render-') as tmp:
        tmp = Path(tmp)
        raw = tmp/'original-fragmented.mp4'
        with raw.open('wb') as f:
            for p in [MEDIA/'init.mp4', *sorted(MEDIA.glob('part*.m4s'))]:
                f.write(p.read_bytes())
        assert hashlib.sha256(raw.read_bytes()).hexdigest() == HLS_SHA
        source = tmp/'source.mp4'
        ff('-i', MEDIA/'film.m3u8', '-c', 'copy', source)
        original = probe(source)
        v = original['streams'][0]
        assert (v['width'],v['height'],v['r_frame_rate'],v['nb_frames']) == (1920,1080,'30/1','6568')
        ff('-ss','110','-i',source,'-frames:v','1',tmp/'clean.png')

        # A feathered clean plate from this same film. Near the moving hair edge,
        # luminance protects Anna's dark foreground instead of freezing her hair.
        # The branch is confined to this region from approximately 117–124 s.
        graph = (
            "[0:v]setpts=PTS-STARTPTS,format=yuv420p[base];"
            "[2:v]setpts=PTS-STARTPTS+116/TB,format=yuv420p,"
            "crop=540:350:300:0,format=gray,"
            "geq=lum='min(1,min(X/12,(W-1-X)/12))*min(1,(H-1-Y)/12)*"
            "if(lt(X,460),255,clip((lum(X,Y)-75)*255/65,0,255))'[mask];"
            "[1:v]trim=duration=9,setpts=PTS+116/TB,format=yuv420p,crop=540:350:300:0[plate];"
            "[plate][mask]alphamerge[patch];"
            "[base][patch]overlay=300:0:eof_action=pass:enable='between(t,116,125)',"
            "split[fixed][cardbase];[cardbase]crop=250:72:840:800[fill];"
            "[fixed][fill]overlay=840:694:enable='lt(n,24)'[v]"
        )
        visual = tmp/'visual.mp4'
        master = tmp/'corrected1080.mp4'
        print('Rendering corrected original-resolution film', flush=True)
        ff('-i', source, '-loop','1','-i',tmp/'clean.png',
            '-ss','116','-t','9','-i',source,
            '-filter_complex_threads','2','-filter_complex',graph,
            '-map','[v]','-an','-frames:v','6568','-r','30','-fps_mode','cfr',
            '-c:v','libx264','-threads','4','-preset','fast','-crf','18',
            '-pix_fmt','yuv420p','-g','240','-keyint_min','240','-sc_threshold','0',
            '-movflags','+faststart',visual)
        # Mux the full original audio only after video encoding, so a video-frame
        # limit cannot drop buffered AAC packets at the end of the film.
        ff('-i',visual,'-i',source,'-map','0:v:0','-map','1:a:0',
            '-c','copy','-r','30','-movflags','+faststart',master)
        out.mkdir(parents=True)
        # Keep the exact existing mobile AAC track and its original timestamps.
        print('Rendering progressive mobile copy and streaming fallback', flush=True)
        ff('-i',master,'-i',MEDIA/'film-mobile.mp4','-map','0:v:0','-map','1:a:0',
            '-vf','scale=1280:720','-c:v','libx264','-threads','4','-preset','fast',
            '-crf','21','-pix_fmt','yuv420p','-g','240','-keyint_min','240',
            '-sc_threshold','0','-c:a','copy','-movflags','+faststart',out/'film-mobile.mp4')
        ff('-i',master,'-c','copy','-f','hls','-hls_time','8','-hls_playlist_type','vod',
            '-hls_segment_type','fmp4','-hls_fmp4_init_filename','init.mp4',
            '-hls_segment_filename',out/'part%03d.m4s',out/'film.m3u8')
        ff('-i',master,'-frames:v','1','-c:v','libwebp','-quality','95',out/'poster.webp')

        print('Verifying complete decode, frame counts, duration and identical AAC', flush=True)
        receipt = {'originalMobileSha256':MP4_SHA,'originalHlsConcatenationSha256':HLS_SHA,
            'videoFrames':6568,'openingCardSeconds':0.8,'backgroundRepairSeconds':[116,125],
            'cleanBackgroundSourceSecond':110,'narrationRegenerated':False}
        for name, original_path in [('film-mobile.mp4',MEDIA/'film-mobile.mp4'),('film.m3u8',source)]:
            target=out/name
            ff('-i',target,'-f','null','-')
            info=probe(target)
            if name == 'film-mobile.mp4':
                assert float(info['streams'][0]['start_time']) == 0
            duration=float(info['format']['duration'])
            assert abs(duration-218.94)<0.03, duration
            count=subprocess.check_output(['ffprobe','-v','error','-select_streams','v:0',
                '-count_frames','-show_entries','stream=nb_read_frames','-of','csv=p=0',str(target)],text=True).strip()
            assert set(count.split()) == {'6568'}, count
            actual_audio=audio_hash(target)
            assert actual_audio == audio_hash(original_path), f'{name}: AAC changed'
            receipt[name]={'duration':duration,'aacSha256':actual_audio,'fullDecode':True}
        assert (out/'film-mobile.mp4').stat().st_size < 100_000_000
        # HTTP cache versions also apply to the HLS init/segments, not just its playlist.
        playlist = out/'film.m3u8'
        text = playlist.read_text().replace('URI="init.mp4"', 'URI="init.mp4?v=20261122-polish"')
        text = '\n'.join(line+'?v=20261122-polish' if line.endswith('.m4s') else line for line in text.split('\n'))
        playlist.write_text(text)
        receipt['files']={p.name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
            for p in sorted(out.iterdir()) if p.is_file()}
        (out/'verification.json').write_text(json.dumps(receipt,indent=2)+'\n')
        print(json.dumps({k:v for k,v in receipt.items() if k!='files'},indent=2),flush=True)

if __name__ == '__main__':
    main()
