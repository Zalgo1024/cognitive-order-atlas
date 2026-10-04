# -*- coding: utf-8 -*-
"""Dump the full structure of the theory DOCX to plain text for reading."""
import sys, io
from docx import Document
from docx.table import Table
from docx.text.paragraph import Paragraph
from docx.oxml.ns import qn

SRC = r".\解释权 · 定义权 · 话语权  .docx"
OUT = r".\程序\dump.txt"

doc = Document(SRC)

def iter_block_items(parent):
    from docx.document import Document as _Doc
    if isinstance(parent, _Doc):
        parent_elm = parent.element.body
    else:
        parent_elm = parent._tc
    for child in parent_elm.iterchildren():
        if child.tag == qn('w:p'):
            yield Paragraph(child, parent)
        elif child.tag == qn('w:tbl'):
            yield Table(child, parent)

buf = io.StringIO()
w = buf.write
pi = 0
ti = 0
for block in iter_block_items(doc):
    if isinstance(block, Paragraph):
        pi += 1
        txt = block.text
        style = block.style.name if block.style is not None else ""
        # heading detection
        mark = ""
        if style.lower().startswith("heading") or style.startswith("标题"):
            mark = "[%s] " % style
        w("%s%s\n" % (mark, txt))
    else:
        ti += 1
        rows = len(block.rows); cols = len(block.columns)
        w("<<TABLE %d  rows=%d cols=%d>>\n" % (ti, rows, cols))
        for r in block.rows:
            cells = [c.text.replace("\n", " / ") for c in r.cells]
            w("  | " + " | ".join(cells) + " |\n")
        w("<<END TABLE %d>>\n" % ti)

with open(OUT, "w", encoding="utf-8") as f:
    f.write(buf.getvalue())

print("paragraphs:", pi, "tables:", ti)
print("chars:", len(buf.getvalue()))
print("lines:", buf.getvalue().count("\n"))
print("sections:", len(doc.sections))
for i, s in enumerate(doc.sections):
    print(" section", i, "pagesize", s.page_width, s.page_height, "orientation", s.orientation)
