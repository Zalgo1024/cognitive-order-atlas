# -*- coding: utf-8 -*-
"""静态校验：JS 语法、ID 引用完整性、标签闭合。"""
import re, os, subprocess, sys, json

HTML = r".\程序\展示页\三权理论 展示页.html"
NODE = r"C:\Users\<user>\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe"
WORK = r".\程序\展示页\_check"

os.makedirs(WORK, exist_ok=True)
src = open(HTML, encoding="utf-8").read()
report = []

# ---------- 1. 抽出 <script> ----------
scripts = re.findall(r"<script[^>]*>(.*?)</script>", src, re.S)
report.append("script blocks: %d" % len(scripts))
js_path = os.path.join(WORK, "app.js")
open(js_path, "w", encoding="utf-8").write("\n".join(scripts))

r = subprocess.run([NODE, "--check", js_path], capture_output=True, text=True, encoding="utf-8")
report.append("node --check -> rc=%s" % r.returncode)
if r.stdout.strip(): report.append("stdout: " + r.stdout.strip())
if r.stderr.strip(): report.append("stderr: " + r.stderr.strip())

# ---------- 2. JS 引用的 ID vs HTML 定义的 ID ----------
defined = set(re.findall(r'\bid="([^"]+)"', src))
used = set()
for m in re.finditer(r"getElementById\(\s*['\"]([^'\"]+)['\"]\s*\)", src):
    used.add(m.group(1))

missing = sorted(i for i in used if i not in defined)
report.append("ids defined in HTML: %d" % len(defined))
report.append("ids referenced by JS: %d" % len(used))
report.append("MISSING ids: %s" % (missing if missing else "none"))

# ---------- 2b. data-id 与 SPECS 键的一一对应 ----------
spec_block = re.search(r"var SPECS = \{(.*?)\n\};", src, re.S)
spec_keys = set()
if spec_block:
    for m in re.finditer(r"^(?:'([^']+)'|([A-Za-z_$][\w$]*)):\s*\{", spec_block.group(1), re.M):
        spec_keys.add(m.group(1) or m.group(2))
figs = re.findall(r'data-ix="([^"]+)"\s+data-id="([^"]+)"', src)
fig_ids = [f[1] for f in figs]
report.append("ix blocks in HTML: %d" % len(figs))
report.append("SPECS keys: %d" % len(spec_keys))
report.append("data-id without SPECS: %s" % (sorted(set(fig_ids) - spec_keys) or "none"))
report.append("SPECS never used: %s" % (sorted(spec_keys - set(fig_ids)) or "none"))
types = {}
for t, _ in figs:
    types[t] = types.get(t, 0) + 1
report.append("ix types: %s" % types)


# querySelector 用到的选择器
for sel in re.findall(r"querySelector(?:All)?\(\s*'([^']+)'", src):
    report.append("  selector used: %s" % sel)

# ---------- 3. 标签闭合（简易配对） ----------
VOID = {"br","img","input","meta","link","hr","source","area","base","col","embed","param","track","wbr"}
stack, errors = [], []
for m in re.finditer(r"<(/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*?)(/?)>", src):
    closing, tag, attrs, self_close = m.group(1), m.group(2).lower(), m.group(3), m.group(4)
    if tag in VOID or self_close:
        continue
    if not closing:
        stack.append((tag, src[:m.start()].count("\n") + 1))
    else:
        if not stack:
            errors.append("line %d: stray </%s>" % (src[:m.start()].count("\n") + 1, tag))
        elif stack[-1][0] != tag:
            errors.append("line %d: </%s> but open <%s> (opened line %d)"
                          % (src[:m.start()].count("\n") + 1, tag, stack[-1][0], stack[-1][1]))
            stack.pop()
        else:
            stack.pop()
report.append("unclosed tags: %s" % ([t for t, _ in stack] if stack else "none"))
report.append("tag errors: %s" % (errors if errors else "none"))

# ---------- 4. 内联 onclick 调用的函数是否存在 ----------
handlers = set(re.findall(r'on(?:click|input)="([A-Za-z_$][\w$]*)\s*\(', src))
declared = set(re.findall(r"function\s+([A-Za-z_$][\w$]*)\s*\(", src))
report.append("inline handlers: %s" % sorted(handlers))
report.append("MISSING handlers: %s" % (sorted(handlers - declared) or "none"))

# ---------- 5. 统计 ----------
report.append("total chars: %d" % len(src))
report.append("total lines: %d" % src.count("\n"))

out = "\n".join(report)
print(out)
open(os.path.join(WORK, "check-report.txt"), "w", encoding="utf-8").write(out)
