# Builds the P4 Purchasing Policy from the Clarus Labs Master Template.
# Only the body, the header document name and the header date change; every other part is copied from the template.
import re, sys, zipfile
from xml.sax.saxutils import escape

TEMPLATE, OUT = sys.argv[1], sys.argv[2]
DOC_NAME = 'P4 Purchasing Policy (Draft)'
DOC_DATE = 'November 24, 2026'
PURPLE, LAVENDER = '6741A0', 'E1D9EC'
CERT = ('I certify that the listed purchases are for official Clarus Labs business purposes, are not personal expenses, '
        'have not been reimbursed elsewhere, and that the information provided is accurate to the best of my knowledge.')

def run(text, bold=False, hl=False):
    rpr = ''
    if bold: rpr += '<w:b/><w:bCs/>'
    if hl: rpr += '<w:highlight w:val="yellow"/>'
    rpr = f'<w:rPr>{rpr}</w:rPr>' if rpr else ''
    return f'<w:r>{rpr}<w:t xml:space="preserve">{escape(text)}</w:t></w:r>'

def runs(text, bold_all=False):
    out = []
    for i, part in enumerate(re.split(r'\*\*', text)):
        bold = bold_all or (i % 2 == 1)
        for seg in re.split(r'(\[[A-Z ,.\'-]+\])', part):
            if seg: out.append(run(seg, bold, hl=bool(re.fullmatch(r'\[[A-Z ,.\'-]+\]', seg))))
    return ''.join(out)

def p(text, style=None, extra=''):
    if style is None and not extra: extra = '<w:contextualSpacing w:val="0"/>'
    ppr = (f'<w:pStyle w:val="{style}"/>' if style else '') + extra
    ppr = f'<w:pPr>{ppr}</w:pPr>' if ppr else ''
    return f'<w:p>{ppr}{runs(text)}</w:p>'

def h1(text, page_break=False):
    # The template numbers its headings automatically; this policy keeps them unnumbered, as the other policies do.
    extra = '<w:keepNext/>' + ('<w:pageBreakBefore/>' if page_break else '') + '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="0"/></w:numPr><w:ind w:left="0" w:firstLine="0"/>'
    return p(text, 'Heading1', extra)

def bullet(text): return p(text, 'ListParagraph')

def table(widths, header, rows, keep_together=True):
    b = lambda sz: f'w:val="single" w:sz="{sz}" w:space="0" w:color="{PURPLE}"'
    tblpr = (f'<w:tblPr><w:tblW w:w="{sum(widths)}" w:type="dxa"/><w:tblBorders>'
             f'<w:top {b(8)}/><w:left {b(8)}/><w:bottom {b(8)}/><w:right {b(8)}/><w:insideH {b(8)}/><w:insideV {b(8)}/>'
             '</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="29" w:type="dxa"/><w:left w:w="108" w:type="dxa"/>'
             '<w:bottom w:w="29" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr>')
    grid = '<w:tblGrid>' + ''.join(f'<w:gridCol w:w="{w}"/>' for w in widths) + '</w:tblGrid>'
    def cell(text, w, fill, head=False, keep=True):
        bottom = f'<w:tcBorders><w:bottom {b(16)}/></w:tcBorders>' if head else ''
        shd = f'<w:shd w:val="clear" w:color="auto" w:fill="{fill}"/>'
        kn = '<w:keepNext/>' if keep else ''
        para = f'<w:p><w:pPr>{kn}<w:spacing w:before="40" w:after="40"/><w:jc w:val="left"/></w:pPr>{runs(text, bold_all=head)}</w:p>'
        return f'<w:tc><w:tcPr><w:tcW w:w="{w}" w:type="dxa"/>{bottom}{shd}</w:tcPr>{para}</w:tc>'
    out = ['<w:tbl>', tblpr, grid]
    out.append('<w:tr><w:trPr><w:cantSplit/><w:tblHeader/></w:trPr>' + ''.join(cell(t, w, 'FFFFFF', True) for t, w in zip(header, widths)) + '</w:tr>')
    for i, row in enumerate(rows):
        fill = LAVENDER if i % 2 == 0 else 'FFFFFF'
        last = i == len(rows) - 1 and keep_together
        out.append('<w:tr><w:trPr><w:cantSplit/></w:trPr>' + ''.join(cell(t, w, fill, keep=not last) for t, w in zip(row, widths)) + '</w:tr>')
    out.append('</w:tbl>')
    return ''.join(out)

def spacer(): return '<w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr></w:p>'

CATEGORIES = [
    ('R&D Materials & Supplies', '6182', 'Materials and supplies for research and development work'),
    ('Equipment', '6175, or 1415 Fixed Assets:Equipment if capitalized', 'Equipment. The administrator decides whether it is expensed or capitalized'),
    ('Advertising/Marketing/Website', '6500', 'Advertising, marketing materials, and website or domain costs'),
    ('Computer, H/W & S/W Supplies', '6178', 'One-time computer hardware and software. Recurring software goes under Dues and Subscriptions'),
    ('Office Supplies', '6180', 'Everyday office supplies'),
    ('Training and Education', '6155', 'Courses, training and educational materials. Conference travel goes through the travel app'),
    ('Shipping/Postage', '6184', 'Shipping and postage'),
    ('Business Insurance', '6215', 'Business insurance premiums'),
    ('Dues and Subscriptions', '6150', 'Recurring subscriptions, including software, and memberships'),
    ('Telephone/Internet', '6185', 'Telephone and internet service'),
    ('Repairs & maintenance', '6170', 'Repairs and maintenance'),
    ('Professional Services', '6050', 'Professional services. The administrator picks the specific account in QuickBooks'),
    ('Other', 'Set by the administrator', 'Anything that fits none of the above. Describe it; the administrator decides the account'),
]

body = []
body.append(p('Purchasing Policy', 'Title'))
body.append(p('Policy P4', 'Subtitle'))
body.append(table([2400, 6960], ['Policy Field', 'Details'], [
    ['Policy Title', 'Purchasing'],
    ['Policy Number', 'P4'],
    ['Effective Date', '[INSERT GO-LIVE DATE.]'],
    ['Approved By', 'Max Wamsley, CEO'],
    ['Applies To', 'All employees and anyone else who buys on behalf of Clarus Labs'],
]))

body.append(h1('Purpose'))
body.append(p('This policy sets the rules for purchases made for Clarus Labs that are not travel. Its purpose is to make sure Clarus buys what the work needs, at a fair price, with approval before the money is spent and a receipt afterward, and that every purchase is recorded accurately. Travel follows the Travel Reimbursement policy (P3) and is submitted in the Travel app.'))

body.append(h1('General Provisions'))
for t in [
    '**Official business:** Purchases are made only for official Clarus Labs business. Personal items and personal expenses are never purchased or reimbursed under this policy.',
    '**Necessary and fair:** Request only what the work needs, at a fair price.',
    '**Approval before purchase:** Purchases are approved before the money is spent. The approval rules are in the Approval section.',
    '**One system of record:** Every purchase is requested and recorded in the Purchase Requests app. The step-by-step instructions are in the Purchase Request SOP.',
]: body.append(bullet(t))

body.append(h1('How a Purchase Is Requested'))
body.append(p('To request a purchase, open the Purchase Requests app and start a request. Give one business purpose and, if a grant pays for it, the project or grant code. Add one row for each item with the vendor, what it is and why Clarus needs it, the estimated amount, the category, and the web address of the item, or the reason there is no web page.'))
body.append(p('Most purchases are bought by the approver. You ask in the app, the approver approves and buys the item, and the receipt goes on the request. You have nothing more to do unless the request is returned with a note. If you buy something yourself, the rules in the Employee-Paid Purchases and Reimbursement section apply.'))
body.append(p('Every request that the approver buys goes to the approver, whatever the amount.'))

body.append(h1('Approval'))
body.append(table([2400, 6960], ['Who buys', 'When approval is needed'], [
    ['The approver', 'Every request, whatever the amount. Approval and purchase are one step.'],
    ['The employee', 'A vendor total of $500 or more within one request, before the purchase. Under $500 needs no approval, but the request is still submitted with receipts.'],
]))
body.append(spacer())
for t in [
    '**Thresholds count by vendor, not by row:** Several rows from the same vendor in one request add up. Splitting a purchase into pieces to stay under $500 is not allowed.',
    '**Who approves:** The site Owners approve requests. An Owner may approve their own request. It is recorded as self-approved, and the record, the email and the CSV file say so.',
    '**Recording a purchase:** An Owner who has already bought something for Clarus may record it in the app. A recorded purchase has no approval step and no employee certification. It needs a receipt or invoice, or a written reason there is none, like any other purchase, and the record shows that the Owner recorded it.',
    '**Changes after approval (employee-bought requests):** If a vendor total ends up more than 10% above the approved amount, or a new vendor total reaches $500, the request goes back for approval before it is submitted. Spending less never needs new approval. When the approver buys, the approver is the one spending, so this check does not apply.',
    '**A purchase already made:** If an employee buys something for $500 or more before approval, the request can still be sent, and it is flagged “Bought before approval”. The approver decides whether to approve it. This is an exception and not a way to work.',
]: body.append(bullet(t))

body.append(h1('Employee-Paid Purchases and Reimbursement'))
body.append(p('The company card or an invoice to Clarus is the default. An employee may buy something and be reimbursed when that is the practical way to get it.'))
for t in [
    'Approval follows the Approval section: none under $500 per vendor, and approval first at $500 or more.',
    'Every row needs a receipt or invoice, or a written reason there is none.',
    'Submit the request within 30 days of the purchase date.',
    'Reimbursement covers only the rows marked as paid by the employee, and only for purchases made under this policy.',
]: body.append(bullet(t))

body.append(h1('Quotes'))
body.append(p('A vendor total of $500 or more needs a quote attached to the request, or a written reason there is none, such as “Already purchased” or a sole source. The approver reads the quote or the reason as part of the approval.'))

body.append(h1('Receipts, Certification and Records'))
for t in [
    '**Receipts:** A receipt or invoice is required for every purchase. One receipt may cover several rows. If there is truly none, the request says why in writing.',
    '**Certification:** The employee who sends the request ticks the following statement, in these exact words: “' + CERT + '” When the employee buys the item, the box is ticked at submission instead.',
    '**Records:** When a request is purchased or submitted, the app builds a folder with the receipts, the quotes and a CSV file, and emails the administrator. The administrator processes it in QuickBooks and files it. Records are kept for [INSERT RECORD RETENTION PERIOD.]',
]: body.append(bullet(t))

body.append(h1('Categories and QuickBooks Accounts'))
body.append(p('The employee suggests a category for each row. Each category is a QuickBooks account, so the choice is the account. The approver confirms or changes it when approving. The categories and their accounts are listed in Appendix A.'))
body.append(p('Equipment has no minimum cost in QuickBooks: anything that is equipment goes in the Equipment account, whatever it costs. The administrator decides how it is booked. Choose Other only when nothing fits, and describe the purchase. The administrator decides the account.'))

body.append(h1('Purchases Paid With Grant Funds'))
for t in [
    '**Grant code:** Every grant purchase carries the project or grant code on the request.',
    '**Allowability:** The approver checks that the purchase is allowable under the award before approving. If the award terms and this policy differ, the award terms rule.',
    '**Equipment over $5,000:** Equipment over $5,000 per item needs prior written approval from the NSF program officer. The approver does not approve or buy the item until that approval is in hand. Keep it with the request. The $5,000 applies to each item, not to the order total.',
]: body.append(bullet(t))
body.append(p('This section covers only grant funds. It does not change how equipment is booked in QuickBooks.'))

body.append(h1('Unallowable Purchases'))
body.append(p('Clarus does not buy, and does not reimburse:'))
for t in [
    'Personal items or personal expenses.',
    'Anything that has been, or will be, reimbursed elsewhere.',
    'Gifts and entertainment, unless the CEO approves them in writing first.',
    'A purchase split into pieces to avoid a threshold.',
]: body.append(bullet(t))

body.append(h1('Roles and Responsibilities'))
body.append(table([2400, 6960], ['Role', 'Responsibility'], [
    ['Employee', 'Requests only what the work needs, gives accurate details, attaches quotes where required, and certifies the request.'],
    ['Approver', 'Approves before the money is spent, confirms categories, checks grant allowability, and when buying, records what was actually paid and attaches the receipt.'],
    ['Administrator', 'Processes the request in QuickBooks, decides the account for Equipment and Other, files the folder, and marks the request processed.'],
]))

body.append(h1('Policy Exceptions'))
body.append(p('The CEO may approve an exception to this policy, in writing, before the purchase. Only the CEO changes this policy, in writing, and the app, the SOP and this policy are updated together so the numbers always match.'))

body.append(h1('Appendix A: Purchase Categories and QuickBooks Accounts'))
body.append(p('The Purchase Requests app offers these categories. The account number is the QuickBooks account that each category is booked to.'))
body.append(table([2700, 2300, 4360], ['Category', 'QuickBooks account', 'What it covers'], [list(c) for c in CATEGORIES], keep_together=False))

src = zipfile.ZipFile(TEMPLATE)
doc = src.read('word/document.xml').decode('utf8')
start = doc.index('<w:body>') + len('<w:body>')
sect = doc[doc.index('<w:sectPr'):doc.index('</w:body>')]
doc = doc[:start] + ''.join(body) + sect + '</w:body></w:document>'
hdr = src.read('word/header1.xml').decode('utf8')
assert 'Document Name Here' in hdr and 'Month dd, yyyy' in hdr
hdr = hdr.replace('Document Name Here', escape(DOC_NAME)).replace('Month dd, yyyy', DOC_DATE)

out = zipfile.ZipFile(OUT, 'w', zipfile.ZIP_DEFLATED)
for info in src.infolist():
    name = info.filename
    if name.startswith('[trash]'): continue   # stray Word artifact; not referenced by any relationship
    data = src.read(name)
    if name == '[Content_Types].xml':
        data = data.replace(b'wordprocessingml.template.main+xml', b'wordprocessingml.document.main+xml')
    elif name == 'word/document.xml': data = doc.encode('utf8')
    elif name == 'word/header1.xml': data = hdr.encode('utf8')
    out.writestr(name, data)
out.close()
print('wrote', OUT)
