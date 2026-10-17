from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import simpleSplit

OUT=Path(__file__).resolve().parent.parent/'submission'/'PackSignal-Submission-Brief.pdf'
W,H=595.28,841.89
c=canvas.Canvas(str(OUT),pagesize=(W,H))
c.setTitle('PackSignal - Esko AIForge submission brief')
INK='#183b2f';MUTED='#63745e';LINE='#dbe3d2';LIME='#e5efcf'
def txt(x,y,text,size=11,font='Helvetica',color=INK):
 c.setFillColor(HexColor(color));c.setFont(font,size);c.drawString(x,y,text)
def para(text,x,y,width=495,size=10,leading=16,color=INK):
 for line in simpleSplit(text,'Helvetica',size,width):txt(x,y,line,size,color=color);y-=leading
 return y

def top(page,section):
 c.setFillColor(HexColor('#f8faf3'));c.rect(0,0,W,H,fill=1,stroke=0)
 txt(45,H-43,'PACKSIGNAL',12,'Helvetica-Bold');txt(383,H-43,'ESKO AIFORGE 2026',9,color=MUTED)
 c.setStrokeColor(HexColor(LINE));c.line(45,H-58,W-45,H-58)
 txt(45,30,'Packaging review | supplied sources | human release decision',8,color=MUTED);txt(W-60,30,str(page),8,color=MUTED)
 txt(45,H-90,section.upper(),9,'Helvetica-Bold',MUTED)
def title(text,y=H-132):txt(45,y,text,27,'Helvetica-Bold');return y-35
def section(name,text,y,gap=20):
 txt(45,y,name,13,'Helvetica-Bold');return para(text,45,y-22)-gap

top(1,'The idea');y=title('Ready for print starts with proof.')
y=para('An evidence-backed artwork reviewer that makes source uncertainty, content discrepancies and revision regressions visible before printing.',45,y,495,13,20)-28
c.setFillColor(HexColor(LIME));c.roundRect(45,y-80,505,86,10,fill=1,stroke=0)
txt(62,y-19,'THE PROOF CHAIN',9,'Helvetica-Bold',MUTED)
txt(62,y-44,'Source fact > Requirement > Artwork evidence',13,'Helvetica-Bold')
txt(62,y-64,'> Check result > Reviewer decision',13,'Helvetica-Bold');y-=122
y=section('The problem','Artwork checking fails when the reference is draft, the correct serving basis is unclear, or missing extracted text is mistaken for missing printed copy. A correction can also introduce a different error.',y)
y=section('Our solution','PackSignal reads actual files, creates a source-linked truth sheet, compares supported requirements, and exposes evidence in a reviewer interface. Human decisions are recorded separately from machine results. A revised artwork triggers a full recheck.',y)
y=section('One challenge, one focused workflow','We address “Is this Packaging Artwork ready to launch?” Source reconciliation supports this artwork-review task. We do not expand the submission into a separate brief-generation product.',y)
y=section('Why the demo is inspectable','Official Dancing Fish files demonstrate real source ambiguity. A clearly labeled fictional Fieldday case demonstrates a quantity mismatch, missing storage copy, and a correction that accidentally removes customer-care information.',y)
c.showPage()

top(2,'Architecture and meaningful AI');y=title('Interpret with AI. Verify with evidence.')
y=para('The same review can run with local exact checks or optional Gemini interpretation. Provider failures remain visible; they do not create invented results. The proof viewer adds source-to-artwork trace, a zoomed evidence spotlight, PDF-calibrated cursor coordinates and a local source-hash recheck.',45,y)-25
boxes=[('1. INPUTS','Artwork PDF/image + product specification + supplied rules'),('2. EXTRACTION','Native PDF text/coordinates, spreadsheet cells, document text'),('3. INTERPRETATION','Local facts + optional Gemini proposals with source quotations'),('4. REVIEW ENGINE','Resolve authority and basis; execute supported comparisons'),('5. HUMAN WORKFLOW','Inspect proof, record decisions, recheck revisions, export')]
for label,body in boxes:
 c.setFillColor(HexColor('#ffffff'));c.setStrokeColor(HexColor(LINE));c.roundRect(45,y-59,505,62,7,fill=1,stroke=1)
 txt(61,y-16,label,10,'Helvetica-Bold');txt(61,y-37,body,9,color=MUTED)
 c.setStrokeColor(HexColor('#769263'));c.line(W/2,y-60,W/2,y-72);y-=78
y-=7
y=section('Where AI earns its place','Gemini can interpret prose requirements, propose facts, read image text and raise evidence-backed questions. Exact code compares quantities, supported wording and numeric values. AI-derived quotations are checked against supplied text; interpretations and transcriptions require review.',y)
y=section('Implementation','Node 24 HTTP server; browser HTML/CSS/JavaScript; Python PDFium, OpenPyXL, python-docx and Pillow for documents; ReportLab exports. Optional official Gemini generateContent API with structured JSON. No model-generated code is executed.',y)
c.showPage()

top(3,'Trust, demonstration and delivery');y=title('Make uncertainty visible.')
y=section('Four distinct outcomes','Matches reference: supported comparison agrees. Issue found: observed discrepancy or confirmed omission. Human review: authority, interpretation, claims or basis is unresolved. Unable to verify: source or extraction coverage is insufficient.',y,10)
y=section('A decision is not a correction','Reviewer acknowledgment does not change the machine result. For a revised artwork, PackSignal retains the references, extracts the new file, reruns all supported checks, and identifies resolved, new, changed and not-rechecked findings.',y,10)
y=section('Evidence the reviewer can inspect','Findings show source quotes, sheet/cell locations, artwork page regions, expected and observed content, and the comparison requirement. Reports include source hashes, coverage limitations, reviewer notes and revision history.',y,10)
y=section('What is delivered','Working application, official organizer samples with provenance, original synthetic pack, artwork check-coverage map, red-green evidence spotlight, prepress HUD, reviewer-mapped carton context, side-by-side revision viewer, guided tour, US/India/EU starter prompts, tabular sibling-SKU screening, environmental-claim evidence prompts, exact approved-language-pair checks, source-bound designer tickets, signed HTML/PDF/JSON reports, demo script and source package.',y,10)
y=section('Current validation boundary','The application has been exercised with the supplied organizer files and known fictional examples. These are not an independent accuracy benchmark. One real Gemini review of the fictional Fieldday V1 files completed using gemini-3.8-flash, returning 19 fact proposals, 12 rule proposals and 2 observations. Reviewer confirmation remains required; this single run is not an accuracy benchmark.',y,10)
y=section('Scope for the judges','The map shows check coverage, not confidence. Carton faces use reviewer-drawn rectangles only for supported supplied checks; no dieline or statutory display panel is inferred. SKU and environmental signals are review prompts. Bilingual checks compare supplied exact phrases, not meaning. The prototype does not certify compliance, print production, barcode quality, translation accuracy or source authority.',y,10)
y=section('Next step','Record the 3-5 minute official-sample walkthrough: proof chain, artwork map, revision regression and human-review boundary. The user performs the final recording and hackathon submission.',y,10)
c.save();print(OUT)
