#!/usr/bin/env python3
"""ACA Phase Two lesson 1.1 — build instructional audio and fictional screen demonstrations.
Creates ONLY newly named, source-grounded lesson media. No curriculum, enrollment or learner changes.
"""
from __future__ import annotations
import hashlib, json, re, subprocess, sys
from pathlib import Path
from urllib.request import Request, urlopen
from PIL import Image, ImageDraw, ImageFont
import av

ROOT=Path(__file__).resolve().parents[2]
HERE=Path(__file__).resolve().parent
MANIFEST=HERE/"J1-L1-1-guided-audio-and-visual-source.json"
SCRIPT=HERE/"J1-L1-1-full-guided-audio-script.md"
OUT=Path(sys.argv[1]).resolve()
OUT.mkdir(parents=True,exist_ok=True)
NAVY="#102d4f"
DEEP="#173d5c"
CREAM="#fbf7ee"
GOLD="#b48632"
SUB="#506d7d"
BLUE="#e7f1f5"
RED="#a34f36"
GREEN="#287e6b"

def run(args):
    subprocess.run(args,check=True,stdout=subprocess.DEVNULL)
def meta(path):
    with av.open(str(path)) as c:
        streams=[{"type":s.type,"codec":s.codec_context.name,
                  "width":getattr(s.codec_context,"width",0),
                  "height":getattr(s.codec_context,"height",0)} for s in c.streams]
        return {"duration":float((c.duration or 0)/av.time_base),"streams":streams}
def font(sz,serif=False,bold=False):
    name="DejaVuSerif-Bold.ttf" if serif and bold else "DejaVuSerif.ttf" if serif else "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"
    return ImageFont.truetype("/usr/share/fonts/truetype/dejavu/"+name,sz)
def wrap(text,f,width,draw):
    words=text.split()
    lines=[];line=""
    for w in words:
        trial=(line+" "+w).strip()
        if draw.textbbox((0,0),trial,font=f)[2]>width and line:
            lines.append(line);line=w
        else:line=trial
    if line:lines.append(line)
    return lines
def write(d,x,y,text,sz=30,color=DEEP,width=None,spacing=12,heavy=False,serif=False):
    f=font(sz,serif,heavy)
    lines=wrap(text,f,width,d) if width else text.split("\n")
    for line in lines:
        d.text((x,y),line,font=f,fill=color)
        y+=sz+spacing
    return y
def rect(d,box,fill,outline=None,width=2,radius=18):
    d.rounded_rectangle(box,radius=radius,fill=fill,outline=outline,width=width)
def chip(d,x,y,label,fill=BLUE,color=DEEP):
    f=font(19,bold=True)
    tw=d.textbbox((0,0),label,font=f)[2]
    rect(d,(x,y,x+tw+32,y+44),fill,radius=18)
    d.text((x+16,y+10),label,font=f,fill=color)
def draw(kind,slide,dest):
    im=Image.new("RGB",(1920,1080),CREAM);d=ImageDraw.Draw(im)
    d.rectangle((0,0,1920,120),fill=NAVY)
    d.ellipse((65,26,138,99),fill=GOLD)
    d.text((86,42),"A",font=font(34,serif=True,bold=True),fill=NAVY)
    write(d,168,39,"AI Confidence Academy",37,"#ffffff",heavy=True,serif=True)
    write(d,1440,48,"PHASE TWO  /  LESSON 1.1",22,"#e9d6ad",heavy=True)
    d.rectangle((0,120,1920,129),fill=GOLD)
    chip(d,92,166,"ILLUSTRATED FICTIONAL CASE",fill="#e1e9ed",color=NAVY)
    headings={
      "01-source":"Start with the approved notes",
      "02-draft":"Inspect the AI-assisted draft",
      "03-review":"Check claims against evidence",
      "04-correct":"Make the report dependable",
    }
    write(d,92,227,headings[kind],56,NAVY,heavy=True,serif=True)
    # left faux application
    rect(d,(90,335,1330,950),"#ffffff",outline="#d5dfe4",radius=22)
    rect(d,(92,337,1328,408),"#dfe9ef",radius=20)
    d.rectangle((92,388,1328,408),fill="#dfe9ef")
    for i,col in enumerate(["#ce7b75","#e4be79","#6ab29c"]):
        d.ellipse((125+37*i,363,141+37*i,379),fill=col)
    labels={"01-source":"Approved weekly notes","02-draft":"AI-assisted leadership summary",
            "03-review":"Source-to-claim review","04-correct":"Reviewed report"}
    write(d,305,351,labels[kind],26,NAVY,heavy=True)
    # step right panel
    rect(d,(1374,335,1826,950),"#f4eddf",outline="#e5cfaa",radius=18)
    write(d,1420,368,"YOUR NEXT MOVE",25,GOLD,heavy=True)
    tips={
     "01-source":[("01","Observe counts"),("02","Identify missing time data"),("03","Identify missing baseline"),("04","Do not infer outcomes")],
     "02-draft":[("01","Read every reported claim"),("02","Find the 95% figure"),("03","Find the improvement claim"),("04","Do not share yet")],
     "03-review":[("01","Trace received / resolved"),("02","Require timing evidence"),("03","Require comparison data"),("04","Name a human reviewer")],
     "04-correct":[("01","Keep source-backed counts"),("02","Withhold unsupported claims"),("03","Record review decision"),("04","Apply to your project")],
    }
    for i,(n,lbl) in enumerate(tips[kind]):
        active=i==slide
        y=448+i*111
        rect(d,(1408,y,1790,y+83),"#ffffff" if active else "#f4eddf",
             outline=GOLD if active else "#e5d9c4",width=3 if active else 1,radius=12)
        write(d,1427,y+19,n,22,GOLD,heavy=True)
        write(d,1478,y+18,lbl,22,NAVY if active else SUB,width=285,spacing=7,heavy=active)
    # Bottom brand footer
    d.rectangle((0,1005,1920,1080),fill=NAVY)
    write(d,91,1025,"AI assists. Humans verify.",24,"#e9d6ad",heavy=True)
    write(d,1480,1024,f"{slide+1} / 4",25,"#e9d6ad",heavy=True)
    if kind=="01-source":
        write(d,150,456,"WEEKLY SERVICE NOTES",27,GOLD,heavy=True)
        rect(d,(150,519,615,719),BLUE,radius=18)
        rect(d,(652,519,1118,719),BLUE,radius=18)
        write(d,189,551,"42",90,NAVY,heavy=True,serif=True)
        write(d,189,664,"requests received",25,DEEP)
        write(d,690,551,"36",90,NAVY,heavy=True,serif=True)
        write(d,690,664,"marked resolved",25,DEEP)
        if slide>=1:
            write(d,155,764,"No response-time record is included.",29,RED,heavy=slide==1,width=1030)
        if slide>=2:
            write(d,155,820,"No previous-period comparison is included.",28,RED,heavy=slide==2,width=1030)
        if slide==3:chip(d,155,891,"SOURCE LIMITS IDENTIFIED",fill="#e5efe9",color=GREEN)
    elif kind=="02-draft":
        write(d,150,458,"Generated summary  /  for review",27,GOLD,heavy=True)
        write(d,160,535,"42 requests received. 36 marked resolved.",34,NAVY,width=1080)
        rect(d,(147,625,1221,713),"#fff6e9" if slide>=1 else "#f2f5f6",
             outline=GOLD if slide>=1 else "#dae3e6",width=4 if slide>=1 else 1,radius=11)
        write(d,173,642,"95% of requests were resolved on time.",32,RED if slide>=1 else DEEP,heavy=slide>=1)
        rect(d,(147,745,1221,833),"#fff6e9" if slide>=2 else "#f2f5f6",
             outline=GOLD if slide>=2 else "#dae3e6",width=4 if slide>=2 else 1,radius=11)
        write(d,173,763,"Service performance improved.",32,RED if slide>=2 else DEEP,heavy=slide>=2)
        if slide==3:chip(d,155,864,"TWO CLAIMS NEED SOURCES",fill="#f9e5df",color=RED)
    elif kind=="03-review":
        rows=[
          ("42 received","Dated weekly tally","TRACE SOURCE"),
          ("36 resolved","Check definition of resolved","TRACE SOURCE"),
          ("95% on time","No timing record exists","WITHHOLD CLAIM"),
          ("Performance improved","No baseline comparison","WITHHOLD CLAIM")
        ]
        for i,(claim,evidence,status) in enumerate(rows):
            y=457+i*100
            active=i==slide
            rect(d,(140,y,1240,y+82), "#f9eee3" if active else "#f8faf9",
                 outline=GOLD if active else "#e0e8e8",width=3 if active else 1,radius=9)
            write(d,163,y+10,claim,27,NAVY,heavy=True)
            write(d,595,y+12,evidence,21,RED if i>=2 else SUB,width=365)
            write(d,1015,y+24,"STOP" if i>=2 else "CHECK",20,RED if i>=2 else GREEN,heavy=True)
    elif kind=="04-correct":
        write(d,150,449,"REVISED REPORT  /  REVIEW REQUIRED",27,GOLD,heavy=True)
        revised=[
         "42 requests were received.",
         "36 were marked resolved in the weekly record.",
         "Available notes do not establish the on-time percentage.",
         "There is no verified evidence of improvement."
        ]
        for i,line in enumerate(revised):
            y=521+i*78
            active=i==slide
            rect(d,(145,y-6,1240,y+65),"#e8f2ed" if active else "#fafbf9",
                 outline=GOLD if active else "#dce5e5",width=3 if active else 1,radius=11)
            write(d,165,y+10,line,25,GREEN if i<2 else RED,heavy=active,width=1010)
        if slide==3:
            write(d,150,861,"Final release: responsible human reviewer",23,NAVY,heavy=True)
    im.save(dest,quality=94)

def fetch(url,path):
    assert url.startswith("https://resource2.heygen.ai/text_to_speech/")
    with urlopen(Request(url,headers={"User-Agent":"Mozilla/5.0"}),timeout=120) as response,open(path,"wb") as file:
        assert response.status==200
        while True:
            chunk=response.read(1024*1024)
            if not chunk:break
            file.write(chunk)
    assert path.stat().st_size>10000,path
    info=meta(path)
    assert any(s["type"]=="audio" for s in info["streams"]),path
    return info["duration"]

def vtt(sec,caption):
    # Word-balanced segmentation provides approximate text alignment;
    # full transcript appears in the lesson even if captions are off.
    sentences=[p.strip() for p in re.split(r"(?<=[.!?])\s+",caption) if p.strip()]
    weight=[max(len(x.split()),1) for x in sentences]
    total=sum(weight)
    result=["WEBVTT","","NOTE Captions timed proportionally by sentence; full transcript follows in lesson.",""]
    at=0.
    def fmt(x):
        h=int(x//3600);m=int(x//60)%60;s=x%60
        return f"{h:02d}:{m:02d}:{s:06.3f}"
    for i,(sentence,w) in enumerate(zip(sentences,weight)):
        end=sec if i==len(sentences)-1 else min(sec,at+sec*w/total)
        result.extend([f"{fmt(at)} --> {fmt(end)}",sentence,""])
        at=end
    return "\n".join(result)

raw=json.loads(MANIFEST.read_text())
assert raw["lesson"]=="1.1" and raw["instructor"]["voice_id"]=="ac277b338cf64d8b9686784c43c563da"
guided=raw["guided_audio"];demos=raw["demonstrations"]
assert len(guided)==4 and len(demos)==4
src=SCRIPT.read_text()
parts=src.split("## Segment ")[1:]
assert len(parts)==4

chapter_tracks=[]
duration_sum=0.
for i,entry in enumerate(guided):
    p=OUT/f"guided_{i+1}.wav"
    sec=fetch(entry["url"],p)
    assert abs(sec-entry["expected_seconds"])<2,(sec,entry["expected_seconds"])
    text=parts[i].split("\n",1)[1]
    text=re.sub(r"\[[^]]+\]","",text)
    text=re.sub(r"\n{3,}","\n\n",text).strip()
    chapter_tracks.append({"title":entry["title"],"start_seconds":round(duration_sum,3),
        "duration_seconds":round(sec,3),"transcript":text})
    duration_sum+=sec+(.9 if i<3 else 0)
sources=[]
for i in range(4):
    sources+=["-i",str(OUT/f"guided_{i+1}.wav")]
filters=[]
for i in range(4):
    filters.append(f"[{i}:a]aresample=48000,aformat=channel_layouts=stereo"+(",apad=pad_dur=0.9" if i<3 else "")+f"[c{i}]")
filters.append("".join(f"[c{i}]" for i in range(4))+"concat=n=4:v=0:a=1[a]")
final_audio=OUT/"ACA-Phase-Two-Lesson-1-1-Guided-Instruction.m4a"
run(["ffmpeg","-hide_banner","-loglevel","error","-y"]+sources+[
    "-filter_complex",";".join(filters),"-map","[a]","-c:a","aac","-b:a","112k",
    "-movflags","+faststart",str(final_audio)
])
audio_duration=meta(final_audio)["duration"]
assert abs(audio_duration-duration_sum)<2,(audio_duration,duration_sum)
assert final_audio.stat().st_size<20_000_000
(OUT/"guided-chapters.json").write_text(json.dumps({
  "title":"Guided instruction", "voice_id":raw["instructor"]["voice_id"],
  "audio_url":"/assets/videos/phase-two-lesson-1-1/ACA-Phase-Two-Lesson-1-1-Guided-Instruction.m4a",
  "duration_seconds":round(audio_duration,3),"chapters":chapter_tracks},indent=2)+"\n")

clip_summary=[]
for clip in demos:
    key=clip["key"]
    audio=OUT/(key+".wav")
    seconds=fetch(clip["url"],audio)
    assert abs(seconds-clip["expected_seconds"])<2,(key,seconds)
    # Four distinctly changed visual states of the same fictional workflow.
    stills=[]
    for slide in range(4):
        path=OUT/f"{key}-slide{slide}.png"
        draw(key,slide,path);stills.append(path)
    video_stages=[]
    for slide,still in enumerate(stills):
        period=(seconds+.5)/4
        stage=OUT/f"{key}-silent-{slide}.mp4"
        run(["ffmpeg","-hide_banner","-loglevel","error","-y",
          "-loop","1","-framerate","30","-i",str(still),"-t",str(period),
          "-c:v","libx264","-preset","veryfast","-crf","23","-r","30",
          "-pix_fmt","yuv420p",str(stage)])
        video_stages.append(stage)
    concat=OUT/f"{key}-parts.txt"
    concat.write_text("\n".join("file '"+str(p)+"'" for p in video_stages)+"\n")
    visuals=OUT/f"{key}-silent.mp4"
    run(["ffmpeg","-hide_banner","-loglevel","error","-y","-f","concat","-safe","0",
      "-i",str(concat),"-c","copy",str(visuals)])
    dest=OUT/f"ACA-Phase-Two-Lesson-1-1-{key}.mp4"
    run(["ffmpeg","-hide_banner","-loglevel","error","-y",
      "-i",str(visuals),"-i",str(audio),
      "-map","0:v:0","-map","1:a:0","-c:v","copy","-c:a","aac","-b:a","128k",
      "-ar","48000","-ac","2","-movflags","+faststart","-shortest",str(dest)])
    info=meta(dest)
    assert abs(info["duration"]-seconds)<2,(key,info["duration"],seconds)
    stream=next(x for x in info["streams"] if x["type"]=="video")
    assert stream["width"]==1920 and stream["height"]==1080
    assert dest.stat().st_size<15_000_000
    caption=OUT/f"ACA-Phase-Two-Lesson-1-1-{key}.vtt"
    caption.write_text(vtt(seconds,clip["script"]))
    clip_summary.append({"key":key,"title":clip["title"],"duration_seconds":round(seconds,3),
        "file":dest.name,"captions":caption.name,
        "bytes":dest.stat().st_size,"sha256":hashlib.sha256(dest.read_bytes()).hexdigest(),
        "transcript":clip["script"],"fictional_training_example":True})

report={"lesson":"1.1","voice_id":raw["instructor"]["voice_id"],"voice_name":"Rika - IA",
  "guided_audio":{"file":final_audio.name,"bytes":final_audio.stat().st_size,
   "duration_seconds":round(audio_duration,3),
   "sha256":hashlib.sha256(final_audio.read_bytes()).hexdigest(),"chapters":len(chapter_tracks)},
  "demonstrations":clip_summary,
  "source_has_original_curriculum_example":True,
  "ready_for_media_attachment":True}
(OUT/"production-report.json").write_text(json.dumps(report,indent=2)+"\n")
print(json.dumps({**report,"demonstrations":[{k:v for k,v in c.items() if k!="transcript"} for c in clip_summary]},indent=2),flush=True)
