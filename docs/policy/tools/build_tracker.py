import sys
from openpyxl import Workbook
from openpyxl.drawing.image import Image as XLImage
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.formatting.rule import CellIsRule
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.utils import get_column_letter as L

LOGO, OUT = sys.argv[1], sys.argv[2]
CHARCOAL, SLATE, PURPLE, LAV = '374151', '64748B', '6741A0', 'E1D9EC'
ACCENTS = ['6741A0', '2F6F9F', '159A8C', '64748B', 'F28C28', '5BBE45']
HEAD = ['Policy number', 'Policy title', 'Version', 'Status', 'Effective date', 'Next review date', 'Approved by', 'Policy owner',
        'Applies to', 'Where it is posted', 'Supersedes', 'Related SOP or form', 'Notes']
WIDTHS = [15, 24, 10, 14, 22, 22, 20, 18, 36, 28, 28, 34, 30]
FIRST, ROWS = 10, 30          # first data row, number of formatted rows
LAST = FIRST + ROWS - 1
P4 = ['P4', 'Purchasing', 'R1', 'Draft', '[INSERT GO-LIVE DATE.]', '[INSERT NEXT REVIEW DATE.]', 'Max Wamsley, CEO', 'Max Wamsley, CEO',
      'All employees and anyone else who buys on behalf of Clarus Labs', '[INSERT POLICY TAB LINK.]', '[CONFIRM WHAT P4 SUPERSEDES.]',
      'Purchase Request SOP (in preparation); Purchase Requests app', 'Draft prepared 2026-11-24. Placeholders to fill before approval.']

wb = Workbook()
ws = wb.active
ws.title = 'Policy Tracker'
ws.sheet_view.showGridLines = False
arial = lambda **k: Font(name='Arial', **k)
thin = Side(style='thin', color=PURPLE)
medium = Side(style='medium', color=PURPLE)

for i, w in enumerate(WIDTHS, 1): ws.column_dimensions[L(i)].width = w

# header block
img = XLImage(LOGO)
img.height = 52
img.width = round(52 * 2000 / 621)
ws.add_image(img, 'A1')
ws.row_dimensions[1].height = 42
ws['A2'] = 'Clarus Labs Policy Tracker'
ws['A2'].font = arial(size=18, bold=True, color=CHARCOAL)
ws.row_dimensions[2].height = 28
ws['A3'] = 'One register for every Clarus Labs policy | As of 2026-11-24'
ws['A3'].font = arial(size=11, color=SLATE)
ws.row_dimensions[3].height = 18
ws.row_dimensions[4].height = 4
for c in range(1, len(HEAD) + 1):
    ws.cell(4, c).fill = PatternFill('solid', fgColor=ACCENTS[(c - 1) % len(ACCENTS)])
notes = [
    'One row per policy. Add a row for each new policy, and use YYYY-MM-DD for dates. Text in [BRACKETS] is a placeholder still to be filled in.',
    'Status: Draft and Under review (orange), In effect (teal), Superseded and Retired (slate). Choose the status from the list.',
    f'="Policies listed: "&COUNTA(A{FIRST}:A{LAST})&"  |  In effect: "&COUNTIF(D{FIRST}:D{LAST},"In effect")&"  |  Draft or under review: "&(COUNTIF(D{FIRST}:D{LAST},"Draft")+COUNTIF(D{FIRST}:D{LAST},"Under review"))',
]
for r, t in enumerate(notes, 5):
    ws.cell(r, 1, t).font = arial(size=9, color=CHARCOAL)
    ws.row_dimensions[r].height = 14

# table header (row 9)
for c, h in enumerate(HEAD, 1):
    cell = ws.cell(FIRST - 1, c, h)
    cell.font = arial(size=10, bold=True, color='000000')
    cell.fill = PatternFill('solid', fgColor='FFFFFF')
    cell.alignment = Alignment(wrap_text=True, vertical='top', horizontal='left')
    cell.border = Border(left=thin, right=thin, top=thin, bottom=medium)
ws.row_dimensions[FIRST - 1].height = 20

# table body
for i in range(ROWS):
    r = FIRST + i
    fill = PatternFill('solid', fgColor=LAV if i % 2 == 0 else 'FFFFFF')
    for c in range(1, len(HEAD) + 1):
        value = P4[c - 1] if i == 0 else None
        cell = ws.cell(r, c, value)
        cell.font = arial(size=10, color='000000')
        cell.fill = fill
        cell.alignment = Alignment(wrap_text=True, vertical='top', horizontal='left')
        cell.border = Border(left=thin, right=thin, top=thin, bottom=thin)
        if isinstance(value, str) and value.startswith('[') and value.endswith(']'):
            cell.fill = PatternFill('solid', fgColor='FFFF00')
    if i == 0: ws.row_dimensions[r].height = 40

# status list and colors
dv = DataValidation(type='list', formula1='"Draft,Under review,In effect,Superseded,Retired"', allow_blank=True)
dv.error = 'Choose a status from the list.'
dv.errorTitle = 'Status'
ws.add_data_validation(dv)
dv.add(f'D{FIRST}:D{LAST}')
rng = f'D{FIRST}:D{LAST}'
for text, color in [('Draft', 'F28C28'), ('Under review', 'F28C28'), ('In effect', '159A8C'), ('Superseded', '64748B'), ('Retired', '64748B')]:
    ws.conditional_formatting.add(rng, CellIsRule(operator='equal', formula=[f'"{text}"'], font=Font(name='Arial', bold=True, color=color)))

ws.freeze_panes = f'A{FIRST}'
ws.auto_filter.ref = f'A{FIRST - 1}:{L(len(HEAD))}{LAST}'
ws.page_setup.orientation = 'landscape'
ws.page_setup.fitToWidth = 1
ws.page_setup.fitToHeight = 0
ws.sheet_properties.pageSetUpPr.fitToPage = True
ws.print_title_rows = f'{FIRST - 1}:{FIRST - 1}'
wb.calculation.fullCalcOnLoad = True
wb.properties.title = 'Clarus Labs Policy Tracker'
wb.save(OUT)
print('wrote', OUT)
