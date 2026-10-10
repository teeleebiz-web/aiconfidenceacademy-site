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
MANIFEST=ROOT/"academy/phase-two-production/J1-L1-1-to-1-4-rendered-sources-v2.json"
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

def card(path,lesson,lines,close=False):
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
        text_center(d,566,"LESSON "+lesson,font(33),GOLD)
        text_center(d,637,lines[0],font(66,True),"#ffffff")
        text_center(d,727,lines[1],font(66,True),"#ffffff")
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


import re
batch=json.loads(MANIFEST.read_text())
scripts=json.loads((ROOT/"academy/phase-two-production/J1-L1-1-to-1-4-standardized-introductions.json").read_text())["lessons"]
assert len(batch["videos"])==4 and len(scripts)==4
styles={
  "1.1":["Professional AI","Judgment and Direction"],
  "1.2":["Find the Need","and Establish the Evidence"],
  "1.3":["Select AI Roles","and Define Business Value"],
  "1.4":["Direct Professional","Requests and Decision Support"]
}
def srt_timestamp(text):
    hours,minutes,other=text.split(":")
    seconds,millis=other.split(",")
    return (int(hours)*3600+int(minutes)*60+int(seconds)+int(millis)/1000)
def stamp(total):
    total_ms=round(total*1000)
    hours,remaining=divmod(total_ms,3600000)
    minutes,remaining=divmod(remaining,60000)
    seconds,millis=divmod(remaining,1000)
    return f"{hours:02}:{minutes:02}:{seconds:02}.{millis:03}"
def shift_srt(srt,seconds):
    return re.sub(r"(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})",
      lambda m: stamp(srt_timestamp(m[1])+seconds)+" --> "+stamp(srt_timestamp(m[2])+seconds),srt)

for lesson in scripts:
    lid=lesson["id"];part=lid.replace(".","-")
    item=next((v for v in batch["videos"] if v["lesson"]==lid),None)
    assert item and item["status"]=="completed"
    videoid=item["video_id"]
    url=item["video_url"]; captions=item.get("subtitle_url")
    assert url.startswith("https://files2.heygen.ai/") and ("/"+videoid+".mp4") in url
    assert captions and captions.startswith("https://files2.heygen.ai/")
    assert lesson["script"].startswith("Welcome back to the AI Confidence Academy.")
    assert lesson["script"].endswith("Let's begin.")
    work=OUT/part
    work.mkdir(exist_ok=True,parents=True)
    source=work/"original.mp4"
    with urlopen(Request(url,headers={"User-Agent":"Mozilla/5.0"}),timeout=180) as inp,source.open("wb") as dst:
        assert inp.status==200
        while chunk:=inp.read(1024*1024):dst.write(chunk)
    assert source.stat().st_size>1_000_000
    original_info=probe(source)
    duration=float(original_info["format"]["duration"])
    assert 40 < duration < 230,(lid,duration)
    assert any(s["codec_type"]=="video" for s in original_info["streams"])
    assert any(s["codec_type"]=="audio" for s in original_info["streams"])
    begin=work/"begin.png";ending=work/"ending.png"
    card(begin,lid,styles[lid])
    card(ending,lid,styles[lid],True)
    dest=OUT/f"assets/videos/phase-two-lesson-{part}"
    dest.mkdir(parents=True,exist_ok=True)
    Image.open(begin).save(dest/"poster-v2.webp","WEBP",quality=88,method=6)
    OPEN=1.5;LAND=.85;END=1.9;RETURN=2.0
    make_card_clip(begin,OPEN,work/"00-opening.mp4")
    make_instructor_clip(source,LAND,work/"01-instructor.mp4")
    make_card_clip(ending,END,work/"02-ending.mp4")
    make_card_clip(begin,RETURN,work/"03-return.mp4")
    parts=work/"segments.txt"
    parts.write_text("\n".join("file '"+str(work/name)+"'" for name in
      ["00-opening.mp4","01-instructor.mp4","02-ending.mp4","03-return.mp4"])+"\n")
    video=dest/f"ACA-Phase-Two-Lesson-{part}-Introduction-v2.mp4"
    call(["ffmpeg","-hide_banner","-loglevel","error","-y",
      "-f","concat","-safe","0","-i",str(parts),"-c","copy","-movflags","+faststart",str(video)])
    info=probe(video);final_seconds=float(info["format"]["duration"])
    assert abs(final_seconds-(duration+OPEN+LAND+END+RETURN))<1,(lid,final_seconds,duration)
    assert any(t["codec_type"]=="video" and t["codec_name"]=="h264" and t["width"]==1920 and t["height"]==1080 for t in info["streams"])
    assert any(t["codec_type"]=="audio" and t["codec_name"]=="aac" for t in info["streams"])
    assert video.stat().st_size<65_000_000
    with urlopen(Request(captions,headers={"User-Agent":"Mozilla/5.0"}),timeout=90) as inp:
        srt=inp.read().decode("utf-8-sig")
    assert "-->" in srt
    vtt=dest/f"ACA-Phase-Two-Lesson-{part}-Introduction-v2.vtt"
    vtt.write_text("WEBVTT\n\n"+shift_srt(srt,OPEN).replace("\r","").strip()+"\n")
    assert "-->" in vtt.read_text()
    points={"first":.06,"speaker":OPEN+4.0,"ending":OPEN+duration+LAND+0.5,"return":final_seconds-0.8}
    for name,second in points.items():
        p=work/(name+".jpg")
        call(["ffmpeg","-hide_banner","-loglevel","error","-y","-ss",str(second),"-i",str(video),"-frames:v","1",str(p)])
        assert p.stat().st_size>1000
    summary={"lesson":lid,"video_id":videoid,"original_seconds":round(duration,3),
      "duration_seconds":round(final_seconds,3),"video_file":video.name,"poster_file":"poster-v2.webp",
      "captions_file":vtt.name,"opening_card_immediate":True,"return_card":True,
      "instructor_voice_id":lesson["voice_id"],"instructor_look_id":lesson["look_id"],
      "spoke_full_lesson_title":True,"intro_closing":"Let's begin.",
      "sha256":hashlib.sha256(video.read_bytes()).hexdigest(),"bytes":video.stat().st_size}
    (dest/"intro-v2-manifest.json").write_text(json.dumps(summary,indent=2)+"\n")
    print(json.dumps(summary),flush=True)
