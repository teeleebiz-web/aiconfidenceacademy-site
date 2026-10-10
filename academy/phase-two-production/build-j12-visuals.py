#!/usr/bin/env python3
"""Create original Lesson 1.2 fictional-case visuals and caption files for private review.

This tool does not download media or deploy anything to the public Academy site.
"""
import json
import re
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
OUT=Path(sys.argv[1]).resolve()
OUT.mkdir(parents=True,exist_ok=True)
MASTER=(HERE/'J1-L1-2-instructional-master.md').read_text()
DATA=json.loads((HERE/'J1-L1-2-audio-source-ids.json').read_text())
NAVY='#102d4f'; GOLD='#b48632'; CREAM='#fbf7ee'
def font(size,bold=False):
    name='DejaVuSans-Bold.ttf' if bold else 'DejaVuSans.ttf'
    return ImageFont.truetype('/usr/share/fonts/truetype/dejavu/'+name,size)
def write(d,text,x,y,width,size=35,color=NAVY,bold=False):
    f=font(size,bold);row=''
    for word in text.split():
        candidate=(row+' '+word).strip()
        if row and d.textbbox((0,0),candidate,font=f)[2]>width:
            d.text((x,y),row,font=f,fill=color)
            y+=size+13;row=word
        else:row=candidate
    if row:d.text((x,y),row,font=f,fill=color)
def rect(d,box,fill,border=None):
    d.rounded_rectangle(box,radius=16,fill=fill,outline=border,width=3)
CASES=[
    ('01-symptom','The symptom is not yet the cause',[
        ('REPORT','Staff report repeated questions.'),
        ('UNKNOWN','No approved frequency count is included.'),
        ('UNKNOWN','No current policy or routing audit is supplied.'),
        ('STOP','A chatbot is not an established requirement.')]),
    ('02-causes','Compare three possible causes',[
        ('A','The approved information may be hard to find.'),
        ('B','Two policy versions may disagree.'),
        ('C','Requests may be routed to the wrong team.'),
        ('VERIFY','Different explanations require different evidence.')]),
    ('03-questions','Ask about experience, not products',[
        ('LEADING','Would you prefer an AI chatbot?'),
        ('BETTER','Where do you look for the current answer?'),
        ('BETTER','What happens when the information is unclear?'),
        ('REVIEW','Remove assumptions before asking anyone.')]),
    ('04-decision','Choose one need provisionally',[
        ('PERSON','Who would benefit from better work?'),
        ('NEED','What do they need without naming a tool?'),
        ('EVIDENCE','What is observed, reported, or not established?'),
        ('REVISE','What evidence would change the decision?')]),
]
def draw_frame(item,highlight,destination):
    key,title,rows=item
    image=Image.new('RGB',(1920,1080),CREAM);d=ImageDraw.Draw(image)
    d.rectangle((0,0,1920,131),fill=NAVY)
    d.ellipse((70,27,142,99),fill=GOLD)
    write(d,'A',90,43,70,31,NAVY,True)
    write(d,'AI Confidence Academy',176,41,1070,36,'#ffffff',True)
    write(d,'PHASE TWO / LESSON 1.2',1440,47,450,22,'#ecd6a7',True)
    d.rectangle((0,131,1920,139),fill=GOLD)
    write(d,'FICTIONAL TRAINING EXAMPLE  /  '+key,100,182,1600,24,GOLD,True)
    write(d,title,100,267,1650,55,NAVY,True)
    for number,(label,statement) in enumerate(rows):
        y=363+number*144
        rect(d,(92,y,1828,y+119),'#e6f0f1' if number==highlight else '#ffffff',
             GOLD if number==highlight else '#d7e3e5')
        write(d,f'{number+1:02d}',117,y+28,100,27,GOLD,True)
        write(d,label,250,y+28,210,22,NAVY,True)
        write(d,statement,485,y+25,1280,32,NAVY,number==highlight)
    d.rectangle((0,1010,1920,1080),fill=NAVY)
    write(d,'AI assists. Humans verify.',94,1028,720,25,'#ecd6a7',True)
    write(d,f'{highlight+1} / 4',1660,1028,180,25,'#ecd6a7',True)
    image.save(destination,optimize=True)
def vtt(script,duration):
    sentences=[x.strip() for x in re.split(r'(?<=[.!?])\s+',script) if x.strip()]
    sizes=[len(x.split()) for x in sentences]; total=sum(sizes)
    times=['WEBVTT','','NOTE Fictional training narration; sentence-level alignment approximated.','']
    at=0.0
    def fmt(n):return f'{int(n//3600):02d}:{int(n//60)%60:02d}:{n%60:06.3f}'
    for index,(sentence,words) in enumerate(zip(sentences,sizes)):
        end=duration if index==len(sentences)-1 else at+duration*words/total
        times += [f'{fmt(at)} --> {fmt(end)}',sentence,''];at=end
    return '\n'.join(times)
manifest=[]
for index,item in enumerate(CASES,1):
    key,title,rows=item
    assert DATA['demonstrations'][index-1]['key']==key
    found=re.search(r'### 0'+str(index)+r' —[\s\S]*?\*\*Narration:\*\* “([^”]+)”',MASTER)
    assert found,'Narration missing: '+key
    narration=found.group(1)
    frames=[]
    for slide in range(4):
        path=OUT/f'{key}-{slide+1}.png'
        draw_frame(item,slide,path)
        assert Image.open(path).size==(1920,1080)
        frames.append(path.name)
    duration=float(DATA['demonstrations'][index-1]['duration_seconds'])
    captions_file=OUT/f'{key}.vtt'
    captions_file.write_text(vtt(narration,duration))
    manifest.append({'key':key,'title':title,'frames':frames,'captions':captions_file.name,
        'narration_duration_seconds':duration,'transcript':narration,
        'source_label':'FICTIONAL TRAINING EXAMPLE'})
(OUT/'illustration-manifest.json').write_text(json.dumps({
    'lesson':'1.2','curriculum':'Six-Week v2.0','status':'founder-review-artwork-not-published',
    'dimensions':'1920x1080','slides':manifest},indent=2)+'\n')
print('Verified 16 high-resolution fictional-case frames and 4 caption tracks.')
