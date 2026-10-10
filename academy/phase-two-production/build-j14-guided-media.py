#!/usr/bin/env python3
"""Build ACA Phase Two Lesson 1.4 approved-voice guided audio and narrated visual demonstrations."""
import json,re,subprocess,sys,hashlib,urllib.request
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

HERE=Path(__file__).parent
ROOT=HERE.parents[1]
DATA=json.loads((HERE/"J1-L1-4-genuine-voice-media-source.json").read_text())
TEXT=(HERE/"J1-L1-4-instructional-master.md").read_text()
OUT=Path(sys.argv[1]).resolve()
OUT.mkdir(parents=True,exist_ok=True)

def run(*args):
    subprocess.run(args,check=True,stdout=subprocess.DEVNULL)
def sec(path):
    return float(subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration","-of","default=nokey=1:noprint_wrappers=1",str(path)]).decode().strip())
def get(url,path):
    req=urllib.request.Request(url,headers={"User-Agent":"ACA-media-builder/1.2"})
    with urllib.request.urlopen(req,timeout=90) as rsp, open(path,"wb") as dst:
        import shutil;shutil.copyfileobj(rsp,dst)
    return sec(path)
def font(size,bold=False):
    path="/usr/share/fonts/truetype/dejavu/"+("DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf")
    return ImageFont.truetype(path,size)
def wrap(draw,txt,f,maxw):
    out=[];current=""
    for word in txt.split():
        test=(current+" "+word).strip()
        if draw.textbbox((0,0),test,font=f)[2]>maxw and current:
            out.append(current);current=word
        else: current=test
    if current:out.append(current)
    return out
def block(draw,txt,x,y,size=29,maxw=945,color="#102d4f",bold=False,line=12):
    f=font(size,bold)
    for t in wrap(draw,txt,f,maxw):
        draw.text((x,y),t,font=f,fill=color);y+=size+line
    return y
SCENES={
"01-vague":[
 ("The founder's vague question","Which service should I offer?","The model lacks a dependable basis for choosing."),
 ("Two possibilities","An approved reference guide or an AI response assistant.","Neither has verified demand yet."),
 ("Three important gaps","Customer evidence, delivery capacity and cost.","Ask relevant questions before recommending.")],
"02-framework":[
 ("Purpose and audience","What useful decision is required? Who relies on it?","Start with the previously investigated need."),
 ("Context and task","Supply approved notes and compare the two approaches.","Do not fill evidence gaps with invented facts."),
 ("Constraints and quality","Protect private information; label evidence and unknowns.","A good answer can say clarification is needed.")],
"03-challenge":[
 ("The AI assertion","Customers will prefer the AI service.","Attractive words are not verified customer evidence."),
 ("Question the source","Which authorized observation supports that preference?","No such source is supplied in this example."),
 ("Correct the report","Customer preference is currently unknown.","Ask for an appropriate, neutral evidence check.")],
"04-memo":[
 ("Alternatives and evidence","Guide versus assistant; cite only supplied material.","Do not treat proposed benefits as established results."),
 ("Tradeoffs and unknowns","Compare cost, capacity and approval requirements.","Keep uncertainty clear and decision reversible."),
 ("Human accountable owner","State a conditional next action and its approver.","Save the memo and revised requests in one Project Record.")]
}

def frame(key,idx,path):
    title,main,note=SCENES[key][idx]
    im=Image.new("RGB",(1280,720),"#fbf7ee");d=ImageDraw.Draw(im)
    d.rectangle((0,0,1280,85),fill="#102d4f")
    d.text((45,23),"AI Confidence Academy",font=font(31,True),fill="#ffffff")
    d.text((914,30),"PHASE TWO  •  1.2",font=font(20,True),fill="#e1c690")
    d.rectangle((0,85,1280,91),fill="#b48632")
    d.text((54,117),"FICTIONAL TRAINING EXAMPLE",font=font(20,True),fill="#906c28")
    block(d,title,54,180,size=39,maxw=1150,bold=True)
    d.rounded_rectangle((50,280,1230,545),radius=17,fill="#ffffff",outline="#d6dee2",width=3)
    block(d,main,85,317,size=31,maxw=1080,bold=True,line=16)
    block(d,note,72,583,size=22,maxw=1135,color="#375668")
    d.rectangle((0,671,1280,720),fill="#102d4f")
    d.text((52,686),"AI assists. Humans verify.",font=font(19,True),fill="#f2dfbe")
    d.text((1143,686),f"{idx+1} / 3",font=font(20,True),fill="#f2dfbe")
    im.save(path)
def vtt(duration,text):
    phrases=re.split(r"(?<=[.!?])\s+",text.strip())
    weights=[max(1,len(p.split())) for p in phrases]
    total=sum(weights);at=0.0;chunks=["WEBVTT","","NOTE Narration is displayed in the caption strip below the video by default.",""]
    def stamp(x):
        ms=round(x*1000);h,rem=divmod(ms,3600000);m,rem=divmod(rem,60000);s,ms=divmod(rem,1000)
        return f"{h:02}:{m:02}:{s:02}.{ms:03}"
    for p,w in zip(phrases,weights):
        end=at+(duration*w/total)
        chunks.extend([f"{stamp(at)} --> {stamp(end)}",p,""]);at=end
    return "\n".join(chunks)
chapters=list(re.finditer(r"### Chapter (\d+) — ([^\n]+)\n([\s\S]*?)(?=\n### Chapter |\n---\n|\n## Four)",TEXT))
assert len(chapters)==4
tracks=[];cues=[];elapsed=0.
for idx,(m,item) in enumerate(zip(chapters,DATA["guided_chapters"])):
    wav=OUT/f"chapter-{idx+1}.wav"
    if item.get("audio_segments"):
        parts=[]
        for k,url in enumerate(item["audio_segments"]):
            part=OUT/f"chapter-{idx+1}-part{k}.wav"
            get(url,part);parts.append(part)
        listing=OUT/f"chapter-{idx+1}-parts.txt"
        listing.write_text("".join("file '"+str(p)+"'\n" for p in parts))
        run("ffmpeg","-hide_banner","-loglevel","error","-y","-f","concat","-safe","0","-i",str(listing),"-c","copy",str(wav))
        duration=sec(wav)
    else:
        duration=get(item["audio_url"],wav)
    assert abs(duration-item["duration_seconds"])<2.5
    cues.append({"title":item["title"],"start_seconds":round(elapsed,3),"duration_seconds":round(duration,3),"transcript":m.group(3).strip()})
    tracks.append(wav);elapsed+=duration+(.9 if idx<3 else 0)
ins=[]
for track in tracks:ins+=["-i",str(track)]
filt=[]
for i in range(4):filt.append(f"[{i}:a]aresample=48000,aformat=channel_layouts=stereo"+(",apad=pad_dur=0.9" if i<3 else "")+f"[a{i}]")
filt.append("".join(f"[a{i}]" for i in range(4))+"concat=n=4:v=0:a=1[aout]")
dest=OUT/"ACA-Phase-Two-Lesson-1-4-Guided-Instruction.m4a"
run("ffmpeg","-hide_banner","-loglevel","error","-y",*ins,"-filter_complex",";".join(filt),"-map","[aout]","-c:a","aac","-b:a","112k",str(dest))
(OUT/"guided-chapters.json").write_text(json.dumps({"title":"Guided instruction","voice_id":DATA["voice_id"],"audio_url":"/assets/videos/phase-two-lesson-1-4/"+dest.name,"duration_seconds":round(sec(dest),3),"chapters":cues},indent=2)+"\n")
demos=list(re.finditer(r"### (0[1-4]) — ([^\n]+)\n\*\*Onscreen:\*\*[\s\S]*?\*\*Narration:\*\* “([\s\S]*?)”\n\*\*Cue:",TEXT))
assert len(demos)==4
results=[]
for idx,(m,item) in enumerate(zip(demos,DATA["demonstrations"])):
    key=item["key"];assert key in SCENES
    wav=OUT/(key+".wav");duration=get(item["audio_url"],wav)
    assert abs(duration-item["duration_seconds"])<2.5
    stages=[]
    for n in range(3):
        image=OUT/f"{key}-{n}.png";frame(key,n,image)
        part=OUT/f"{key}-{n}.mp4"
        run("ffmpeg","-hide_banner","-loglevel","error","-y","-loop","1","-framerate","24","-i",str(image),"-t",str((duration+.5)/3),"-c:v","libx264","-pix_fmt","yuv420p","-preset","veryfast",str(part))
        stages.append(part)
    listfile=OUT/f"{key}.txt";listfile.write_text("".join("file '"+str(x)+"'\n" for x in stages))
    silent=OUT/f"{key}-silent.mp4"
    run("ffmpeg","-hide_banner","-loglevel","error","-y","-f","concat","-safe","0","-i",str(listfile),"-c","copy",str(silent))
    video=OUT/f"ACA-Phase-Two-Lesson-1-4-{key}.mp4"
    run("ffmpeg","-hide_banner","-loglevel","error","-y","-i",str(silent),"-i",str(wav),"-map","0:v:0","-map","1:a:0","-c:v","copy","-c:a","aac","-b:a","128k","-shortest","-movflags","+faststart",str(video))
    captions=OUT/f"ACA-Phase-Two-Lesson-1-4-{key}.vtt";captions.write_text(vtt(sec(video),m.group(3)))
    results.append({"key":key,"title":item["title"],"duration_seconds":round(sec(video),3),"file":video.name,"captions":captions.name,"bytes":video.stat().st_size,"sha256":hashlib.sha256(video.read_bytes()).hexdigest(),"transcript":m.group(3),"fictional_training_example":True})
report={"lesson":"1.4","voice_id":DATA["voice_id"],"guided_audio":{"file":dest.name,"duration_seconds":round(sec(dest),3),"chapters":len(cues),"bytes":dest.stat().st_size},"demonstrations":results,"media_hosted":False}
(OUT/"production-report.json").write_text(json.dumps(report,indent=2)+"\n")
print(json.dumps({"lesson":"1.4","audio_seconds":round(sec(dest),3),"demonstrations":len(results)},indent=2))
