
from PIL import Image, ImageDraw, ImageFont
import sys, os
proj = os.path.expanduser("~/lab/gibwork/gib-gate")
def font(sz):
    for p in ["/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf","/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"]:
        if os.path.exists(p): return ImageFont.truetype(p, sz)
    return ImageFont.load_default()
def render(infile, outfile, title):
    txt = open(infile).read().rstrip("\n")
    lines = txt.split("\n")
    W = 1100; pad=28; lh=26; top=70
    H = top + len(lines)*lh + pad*2
    img = Image.new("RGB",(W,H),(18,18,24)); d=ImageDraw.Draw(img)
    # titlebar
    d.rectangle([0,0,W,52], fill=(40,40,48))
    for i,c in enumerate([(255,95,86),(255,189,46),(39,201,63)]):
        d.ellipse([22+i*22,18,36+i*22,32], fill=c)
    d.text((96,16), title, fill=(220,220,220), font=font(17))
    f=font(16)
    for i,line in enumerate(lines):
        col=(220,220,220)
        if line.strip().startswith("⛔") or "BLOCKER" in line or "NO-GO" in line: col=(255,120,120)
        elif line.strip().startswith("⚠️") or "WARN" in line: col=(255,200,120)
        elif line.strip().startswith("✅") or line.strip().startswith("✔"): col=(120,230,140)
        elif line.strip().startswith("🚦") or line.strip().startswith("🎯") or line.strip().startswith("📋") or line.strip().startswith("📁"): col=(130,190,255)
        d.text((pad, top+i*lh), line[:150], fill=col, font=f)
    img.save(outfile)
    print("wrote", outfile, img.size)
render(proj+"/demo/gate.txt", proj+"/demo/screenshot-gate.png", "gib-gate gate <task>  —  hidden submission gates")
render(proj+"/demo/audit.txt", proj+"/demo/screenshot-audit.png", "gib-gate audit <task> --repo .  —  submission readiness")
