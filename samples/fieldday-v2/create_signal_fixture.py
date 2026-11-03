"""Original supplementary artwork for language and barcode review demonstrations."""
from pathlib import Path
from io import BytesIO
import hashlib, json
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.graphics.barcode import code128, qr
from reportlab.graphics.shapes import Drawing
from reportlab.graphics import renderPDF
from pypdf import PdfReader, PdfWriter

root = Path(__file__).resolve().parent
buffer = BytesIO()
c = canvas.Canvas(buffer, pagesize=(840, 620))
c.setTitle('Fieldday - fictional multilingual and barcode review sample')
c.setFillColor(HexColor('#f5f7ee')); c.rect(0, 0, 840, 620, fill=1, stroke=0)
def text(x, y, value, size=12, font='Helvetica', color='#173a2e'):
    c.setFillColor(HexColor(color)); c.setFont(font, size); c.drawString(x, y, value)
text(40, 578, 'FIELDDAY / SUPPLEMENTARY ARTWORK', 12, 'Helvetica-Bold')
text(40, 545, 'Languages and code locations', 28, 'Helvetica-Bold')
text(40, 518, 'FICTIONAL DEMO - NOT FOR SALE', 11, 'Helvetica-Bold', '#995039')
text(40, 495, 'Translations are supplied as unapproved artwork, not an authoritative reference.', 11)
for x in (40, 435):
    c.setFillColor(HexColor('#ffffff')); c.roundRect(x, 285, 365, 175, 8, fill=1, stroke=0)
text(60, 432, 'SPANISH COPY / UNVERIFIED', 10, 'Helvetica-Bold')
text(60, 402, 'Ingredientes: agua, avena.', 13)
text(60, 376, 'Conservar en un lugar fresco y seco.', 13)
text(60, 350, 'Contenido neto: 1 L.', 13)
text(60, 315, 'No translation approval supplied.', 10, color='#6c7a61')
text(455, 432, 'FRENCH COPY / UNVERIFIED', 10, 'Helvetica-Bold')
text(455, 402, 'Ingrédients : eau, avoine.', 13)
text(455, 376, 'À conserver au frais après ouverture.', 13)
text(455, 350, 'À consommer de préférence avant :', 12)
text(455, 332, 'voir emballage.', 12)
text(455, 308, 'No translation approval supplied.', 10, color='#6c7a61')
text(40, 250, 'CODE128 / FICTIONAL INTERNAL IDENTIFIER', 10, 'Helvetica-Bold')
barcode = code128.Code128('PACKSIGNAL-DEMO-1042', barHeight=64, barWidth=1.15, humanReadable=False, quiet=True)
barcode.drawOn(c, 35, 164)
text(55, 145, 'PACKSIGNAL-DEMO-1042 - not a registered retail GTIN', 9)
text(595, 250, 'QR / NON-URL DEMO PAYLOAD', 10, 'Helvetica-Bold')
widget=qr.QrCodeWidget('packsignal:fictional-demo', barLevel='M')
x1,y1,x2,y2=widget.getBounds()
d=Drawing(112,112,transform=[112/(x2-x1),0,0,112/(y2-y1),0,0]); d.add(widget)
renderPDF.draw(d,c,645,125)
text(40, 90, 'Detection demonstrates symbol presence and approximate location only.', 11)
text(40, 70, 'It does not validate print grade, retail assignment, destination safety, or translated copy.', 11)
text(40, 35, 'Original synthetic PackSignal material. No product certification or translation accuracy is asserted.', 9, color='#6c7a61')
c.save(); buffer.seek(0)
writer=PdfWriter()
writer.append(PdfReader(root/'artwork/fieldday-baseline.pdf'))
writer.append(PdfReader(buffer))
out=root/'artwork/fieldday-signals.pdf'
with out.open('wb') as stream: writer.write(stream)
(root/'evaluation/signal-fixture.json').write_text(json.dumps({
    'synthetic':True,'file':'artwork/fieldday-signals.pdf','sha256':hashlib.sha256(out.read_bytes()).hexdigest(),
    'purpose':'Known authored signal example, not an independent benchmark.',
    'page_2':{'language_cues':['Spanish','French'],'codes':['Code128','QR Code'],
              'limits':'Translations unapproved; codes are fictional and do not establish retail or print compliance.'}
},indent=2)+'\n')
print(out)
