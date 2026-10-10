#!/usr/bin/env python3
"""Build one ACA-approved instructor MP4 with embedded opening and ending cards.

Used only in a guarded GitHub Actions workflow. Do not change the narration or avatar.
"""
from __future__ import annotations
import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path
from urllib.request import Request, urlopen
from PIL import Image, ImageDraw, ImageFont
import av

ROOT=Path(__file__).resolve().parents[2]
MANIFEST=ROOT/"academy/phase-two-production/J1-L1-6-signed-source.json"
OUT=Path(sys.argv[1]).resolve()
OUT.mkdir(parents=True,exist_ok=True)
FONT_DIR="/usr/share/fonts/truetype/dejavu"
NAVY="#102d4f"
GOLD="#d4b36b"
LITE="#e4eaf1"
SEAL=ROOT/"aca-official-seal.png"

def call(args):
    subprocess.run(args,check=True)

def probe(path):
    # PyAV offers real FFmpeg demuxing/metadata without a separate ffprobe binary.
    with av.open(str(path)) as reader:
        duration = (reader.duration or 0) / av.time_base
        streams = []
        for stream in reader.streams:
            context = stream.codec_context
            item = {"codec_type": stream.type, "codec_name": context.name}
            if stream.type == "video":
                item.update(width=context.width, height=context.height)
            streams.append(item)
    return {"format": {"duration": str(duration)}, "streams": streams}

def font(sz,serif=False):
    return ImageFont.truetype(FONT_DIR+("/DejaVuSerif.ttf" if serif else "/DejaVuSans.ttf"),sz)

def text_center(d,y,text,face,color):
    x0,y0,x1,y1=d.textbbox((0,0),text,font=face)
    d.text(((1920-(x1-x0))/2,y),text,font=face,fill=color)

def card(path,close=False):
    canvas=Image.new("RGB",(1920,1080),NAVY)
    d=ImageDraw.Draw(canvas)
    d.rectangle((50,50,1870,1030),outline=GOLD,width=3)
    d.rectangle((76,76,1844,1004),outline="#566d83",width=1)
    logo=Image.open(SEAL).convert("RGBA")
    logo.thumbnail((210,210),Image.Resampling.LANCZOS)
    canvas.paste(logo,((1920-logo.width)//2,118),logo)
    text_center(d,370,"AI CONFIDENCE ACADEMY",font(47,True),GOLD)
    text_center(d,451,"PHASE TWO   ·   JOURNEY ONE",font(27),LITE)
    d.line((810,516,1110,516),fill=GOLD,width=3)
    if close:
        text_center(d,580,"Continue with your project",font(54,True),"#ffffff")
        text_center(d,665,"Keep the evidence. Own the decision.",font(28),LITE)
    else:
        text_center(d,566,"LESSON 1.6",font(33),GOLD)
        text_center(d,637,"Stress Test the",font(66,True),"#ffffff")
        text_center(d,727,"Professional Operating Model",font(66,True),"#ffffff")
    text_center(d,921,"AI assists. Humans verify.",font(26),GOLD)
    canvas.save(path,optimize=True)

def make_card_clip(image,seconds,destination):
    call(["ffmpeg","-hide_banner","-loglevel","error","-y",
      "-loop","1","-framerate","30","-i",str(image),
      "-f","lavfi","-i","anullsrc=r=48000:cl=stereo",
      "-t",str(seconds),"-r","30","-c:v","libx264","-preset","veryfast",
      "-crf","21","-pix_fmt","yuv420p","-c:a","aac","-b:a","128k",
      "-ar","48000","-ac","2",str(destination)])

def make_instructor_clip(src,seconds,destination):
    call(["ffmpeg","-hide_banner","-loglevel","error","-y",
      "-i",str(src),"-filter_complex",
      "[0:v]scale=1920:1080:force_original_aspect_ratio=decrease,"
      "pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,"
      "tpad=stop_mode=clone:stop_duration="+str(seconds)+"[v];"
      "[0:a]aresample=48000,aformat=channel_layouts=stereo,"
      "apad=pad_dur="+str(seconds)+"[a]",
      "-map","[v]","-map","[a]",
      "-c:v","libx264","-preset","veryfast","-crf","23",
      "-maxrate","1650k","-bufsize","3300k","-r","30",
      "-pix_fmt","yuv420p","-c:a","aac","-b:a","128k",
      "-ar","48000","-ac","2",str(destination)])

raw=json.loads(MANIFEST.read_text())
assert raw.get("video_id")=="1911a88075a2fd8827e8cbfde4dd6418"
url=raw["source_url"]
assert url.startswith("https://files2.heygen.ai/") and "/1911a88075a2fd8827e8cbfde4dd6418.mp4" in url
source=OUT/"original.mp4"
with urlopen(Request(url,headers={"User-Agent":"Mozilla/5.0"}),timeout=180) as inp,source.open("wb") as dst:
    assert inp.status==200
    while True:
        chunk=inp.read(1024*1024)
        if not chunk:break
        dst.write(chunk)
assert source.stat().st_size>1_000_000
src_info=probe(source)
duration=float(src_info["format"]["duration"])
streams=src_info["streams"]
assert 80<=duration<=102,duration
assert any(s["codec_type"]=="audio" for s in streams)
assert any(s["codec_type"]=="video" for s in streams)
print("Source approved avatar:",round(duration,2),"seconds",source.stat().st_size,"bytes",flush=True)

begin=OUT/"begin.png"
ending=OUT/"ending.png"
card(begin)
card(ending,True)
Image.open(begin).save(OUT/"poster.webp","WEBP",quality=88,method=6)

OPEN=1.5
LAND=0.85
END=1.9
RETURN=2.0
make_card_clip(begin,OPEN,OUT/"00-opening.mp4")
make_instructor_clip(source,LAND,OUT/"01-instructor.mp4")
make_card_clip(ending,END,OUT/"02-ending.mp4")
make_card_clip(begin,RETURN,OUT/"03-return.mp4")
segments=OUT/"segments.txt"
segments.write_text("\n".join(["file '"+str(OUT/(name))+"'" for name in ["00-opening.mp4","01-instructor.mp4","02-ending.mp4","03-return.mp4"]])+"\n")
final=OUT/"ACA-Phase-Two-Lesson-1-6-Introduction.mp4"
call(["ffmpeg","-hide_banner","-loglevel","error","-y",
  "-f","concat","-safe","0","-i",str(segments),
  "-c","copy","-movflags","+faststart",str(final)])
info=probe(final)
fdur=float(info["format"]["duration"])
assert abs(fdur-(duration+OPEN+LAND+END+RETURN))<0.8,(fdur,duration)
v=next(s for s in info["streams"] if s["codec_type"]=="video")
a=next(s for s in info["streams"] if s["codec_type"]=="audio")
assert v["codec_name"]=="h264" and int(v["width"])==1920 and int(v["height"])==1080
assert a["codec_name"]=="aac"
assert final.stat().st_size<48_000_000,final.stat().st_size

# Decode and sample first, speaker, ending, last returned card. Verification
# images are build artifacts, not publicly displayed or installed in the portal.
points={"first":0.06,"speaker":4.0,"landing":OPEN+duration+0.3,
        "ending":OPEN+duration+LAND+0.5,"return":fdur-0.8}
for name,second in points.items():
    output=OUT/(name+".jpg")
    call(["ffmpeg","-hide_banner","-loglevel","error","-y","-ss",str(second),
          "-i",str(final),"-frames:v","1",str(output)])
    assert output.stat().st_size>1000
checksum=hashlib.sha256(final.read_bytes()).hexdigest()
summary={
 "approved_heygen_video_id":raw["video_id"],
 "source_duration_seconds":round(duration,3),
 "completed_duration_seconds":round(fdur,3),
 "opening_seconds":OPEN,
 "instructor_last_word_landing_seconds":LAND,
 "end_card_seconds":END,
 "returned_beginning_card_seconds":RETURN,
 "start_frame_is_beginning_card":True,
 "last_frame_is_beginning_card":True,
 "format":"1920x1080 H.264 MP4 / AAC",
 "bytes":final.stat().st_size,
 "sha256":checksum,
 "max_display_width_px":640,
}
(OUT/"media-manifest.json").write_text(json.dumps(summary,indent=2)+"\n")
print(json.dumps(summary),flush=True)
