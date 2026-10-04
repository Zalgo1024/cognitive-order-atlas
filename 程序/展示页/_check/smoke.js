/* 三权理论 展示页 · 运行时冒烟测试
   用最小 DOM 桩件真实执行页面脚本，验证交互逻辑与 canvas 绘制不抛错。 */
const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync(process.argv[2], 'utf8');
const script = html.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1];

/* ---------- canvas 2D 桩件 ---------- */
const gradient = { addColorStop() {} };
const ctx = new Proxy({}, {
  get(t, k) {
    if (k === 'measureText') return (s) => ({ width: String(s).length * 8 });
    if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => gradient;
    if (k in t) return t[k];
    return () => {};
  },
  set(t, k, v) { t[k] = v; return true; }
});

/* ---------- Style 桩件 ---------- */
class Style {
  constructor() { this._p = {}; this.width = ''; this.display = ''; this.height = ''; this.left = ''; }
  setProperty(k, v) { this._p[k] = v; }
  getPropertyValue(k) { return this._p[k] || ''; }
}

/* ---------- Element 桩件 ---------- */
class El {
  constructor(tag, id) {
    this.tagName = (tag || 'div').toUpperCase();
    this.id = id || '';
    this._cls = new Set();
    this.children = [];
    this.parent = null;
    this._text = '';
    this._html = '';
    this.style = new Style();
    this.value = '0';
    this.attrs = {};
    this.handlers = {};
    this.width = 960; this.height = 700;
  }
  get classList() {
    const s = this._cls;
    return {
      add: (...c) => c.forEach(x => s.add(x)),
      remove: (...c) => c.forEach(x => s.delete(x)),
      toggle: (c, f) => { if (f === undefined) { s.has(c) ? s.delete(c) : s.add(c); } else { f ? s.add(c) : s.delete(c); } return s.has(c); },
      contains: (c) => s.has(c)
    };
  }
  get className() { return [...this._cls].join(' '); }
  set className(v) { this._cls = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get textContent() { return this._text || this._html.replace(/<[^>]*>/g, ''); }
  set textContent(v) { this._text = String(v); }
  get innerHTML() { return this._html; }
  set innerHTML(v) { this._html = String(v); this.children = []; }
  appendChild(c) { c.parent = this; this.children.push(c); return c; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k]; }
  addEventListener(t, f) { (this.handlers[t] = this.handlers[t] || []).push(f); }
  getBoundingClientRect() { return { top: 10, left: 0, width: 1200, height: 600 }; }
  getContext() { return ctx; }
  querySelector(sel) {
    const tag = sel.replace(/^[.#]/, '').toLowerCase();
    const walk = (n) => {
      for (const c of n.children) {
        if (c.tagName.toLowerCase() === tag || c._cls.has(tag)) return c;
        const r = walk(c); if (r) return r;
      }
      return null;
    };
    return walk(this);
  }
  querySelectorAll(sel) { return typeof sel === 'string' ? [] : []; }
  get nextElementSibling() { if (!this.parent) return null; const i = this.parent.children.indexOf(this); return this.parent.children[i + 1] || null; }
  /* 递归统计（含通过 innerHTML 生成的元素） */
  count() { return this.children.length; }
  deepText() { return (this._text + this._html).replace(/<[^>]*>/g, ''); }
}

/* ---------- 从 HTML 建立元素注册表 ---------- */
const registry = new Map();
const tagRe = /<([a-zA-Z][\w-]*)([^>]*?)\/?>/g;
let m;
while ((m = tagRe.exec(html))) {
  const tag = m[1], attrs = m[2];
  const idm = /\bid="([^"]+)"/.exec(attrs);
  if (idm) {
    const el = new El(tag, idm[1]);
    const vm2 = /\bvalue="([^"]*)"/.exec(attrs);
    if (vm2) el.value = vm2[1];
    registry.set(idm[1], el);
  }
}
/* 特殊元素：需要被 querySelectorAll 命中的集合 */
const rvList = [];
const classRe = /<([a-zA-Z][\w-]*)([^>]*?\bclass="([^"]*)"[^>]*?)>/g;
while ((m = classRe.exec(html))) {
  for (const c of m[3].split(/\s+/)) {
    if (c === 'rv') rvList.push(new El(m[1]));
  }
}
const pages = ['p1', 'p2', 'p3'].map(id => registry.get(id) || new El('div', id));
const navButtons = ['p1', 'p2', 'p3'].map(id => { const b = new El('button'); b.attrs['data-page'] = id; return b; });

/* ---------- document / window ---------- */
const document = {
  getElementById: (id) => registry.get(id) || null,
  createElement: (t) => new El(t),
  querySelectorAll: (sel) => {
    if (sel === '.page') return pages;
    if (sel === '.nav button') return navButtons;
    if (sel === '.rv') return rvList;
    return [];
  },
  querySelector: (sel) => {
    const m2 = /data-page="([^"]+)"/.exec(sel);
    if (m2) return navButtons.find(b => b.attrs['data-page'] === m2[1]) || null;
    return null;
  },
  addEventListener() {}
};

let intervals = 0;
const window = {
  innerHeight: 900, innerWidth: 1440,
  addEventListener() {},
  scrollTo() {},
  IntersectionObserver: class { constructor() {} observe() {} },
  requestAnimationFrame: () => 0,
  cancelAnimationFrame: () => {},
  setTimeout: (f) => { intervals++; return 0; },
  setInterval: (f) => { intervals++; return 0; },
  clearInterval: () => {},
  clearTimeout: () => {}
};

const sandbox = {
  document, window,
  IntersectionObserver: window.IntersectionObserver,
  requestAnimationFrame: window.requestAnimationFrame,
  cancelAnimationFrame: window.cancelAnimationFrame,
  setTimeout, setInterval, clearInterval, clearTimeout,
  console, Math, Object, Array, String, Number, JSON, parseInt, parseFloat, isNaN
};
sandbox.globalThis = sandbox;

/* ---------- 执行页面脚本 ---------- */
const failures = [];
function check(name, cond, extra) {
  const ok = !!cond;
  console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (extra !== undefined ? '  → ' + extra : ''));
  if (!ok) failures.push(name);
}

console.log('=== 1. 执行页面脚本 ===');
let threw = null;
try {
  vm.runInNewContext(script, sandbox, { filename: 'page.js' });
} catch (e) {
  threw = e;
}
check('脚本执行无异常', !threw, threw ? threw.message : 'ok');
if (threw) { console.log(threw.stack); process.exit(1); }

console.log('\n=== 2. 交互组件初始渲染 ===');
const g = id => registry.get(id);
check('定义闭合：4 个标签按钮', g('closureChips').children.length === 4, g('closureChips').children.length);
check('定义闭合：4 条反应行', g('closureRows').children.length === 4, g('closureRows').children.length);
check('定义闭合：徽标已填充', /不理性/.test(g('closureBadge').deepText()), JSON.stringify(g('closureBadge').deepText().slice(0, 30)));
check('定义闭合：结论说明已填充', g('closureNote').deepText().length > 20, g('closureNote').deepText().length + ' 字');
check('因果链：9 个子元素（5 节点 + 4 箭头）', g('causalChain').children.length === 9, g('causalChain').children.length);
check('因果链：结论已填充', g('causalConclusion').textContent === '个人失误', g('causalConclusion').textContent);
check('因果链：责任落点已填充', /操作人员/.test(g('causalDuty').textContent), g('causalDuty').textContent);
check('传播链：7 个子元素（2 端 + 5 闸门）', g('pipeTrack').children.length === 7, g('pipeTrack').children.length);
check('传播链：默认全开说明', /五道闸门全开/.test(g('pipeNote').deepText()), g('pipeNote').deepText().slice(0, 14));
check('状态机：标题 = 仅掌握定义权', g('smTitle').textContent === '仅掌握定义权', g('smTitle').textContent);
check('状态机：能够做到已填充', /创造名称/.test(g('smCan').textContent), g('smCan').textContent);
check('状态机：卡在哪里已填充', /无法保证概念被广泛使用/.test(g('smStuck').textContent), g('smStuck').textContent.slice(0, 20));
check('债务时钟：债务条宽度 = 8%', g('debtBar').style.width === '8%', g('debtBar').style.width);
check('债务时钟：可见性已计算', /\/ 100/.test(g('visVal').textContent), g('visVal').textContent);
check('债务时钟：反噬卡片默认收起', !g('debtReversal').classList.contains('show'));

console.log('\n=== 3. 状态机全 8 状态覆盖 ===');
check('swState 可从外部访问', !!sandbox.swState, JSON.stringify(sandbox.swState));
const SM_TABLE = {
  '100': ['仅掌握定义权', '单权状态'],
  '010': ['仅掌握解释权', '单权状态'],
  '001': ['仅掌握话语权', '单权状态'],
  '110': ['定义权 ＋ 解释权', '两权主导'],
  '101': ['定义权 ＋ 话语权', '两权主导'],
  '011': ['解释权 ＋ 话语权', '两权主导'],
  '111': ['三权齐备', '闭环控制'],
  '000': ['认知消灭', '三权尽失']
};
Object.keys(SM_TABLE).forEach(key => {
  sandbox.swState.def = key[0] === '1';
  sandbox.swState.exp = key[1] === '1';
  sandbox.swState.dis = key[2] === '1';
  sandbox.renderSM();
  const want = SM_TABLE[key];
  const gotT = g('smTitle').textContent, gotG = g('smTag').textContent;
  check(key + ' → ' + want[0], gotT === want[0] && gotG === want[1], gotT + ' / ' + gotG);
  check(key + ' → 三个面板均已填充', g('smCan').textContent.length > 5 && g('smStuck').textContent.length > 5 && g('smState').textContent.length > 2 && g('smFoot').deepText().length > 20);
});
/* 复位 */
sandbox.swState.def = true; sandbox.swState.exp = false; sandbox.swState.dis = false;
sandbox.renderSM();

console.log('\n=== 4. 交互行为 ===');
/* 债务滑块推到临界 */
g('debtRange').value = '95';
sandbox.updateDebt();
check('债务时钟：临界时展开反噬卡片', g('debtReversal').classList.contains('show'));
check('债务时钟：临界时 zone 加 hot 类', g('debtZone').classList.contains('hot'));
check('债务时钟：可见性接近饱和', parseInt(g('visVal').textContent, 10) > 90, g('visVal').textContent);

/* 债务滑块回到安全区 */
g('debtRange').value = '10';
sandbox.updateDebt();
check('债务时钟：回落时收起反噬卡片', !g('debtReversal').classList.contains('show'));
check('债务时钟：低区间显示留有余地', /留有余地/.test(g('debtZone').deepText()));

/* 传播链：关闭第 3 道闸门 */
g('pipeTrack').children[3].onclick();
check('传播链：关闭「抵达」后说明切换', /停在「抵达」/.test(g('pipeNote').deepText()), g('pipeNote').deepText().slice(0, 12));
check('传播链：受阻闸门加 blocked 类', g('pipeTrack').children[3].classList.contains('blocked'));
check('传播链：后续闸门置灰', g('pipeTrack').children[4].classList.contains('dim'));

/* 传播链：再关闭第 1 道闸门，应停在更早的位置 */
g('pipeTrack').children[1].onclick();
check('传播链：停在更早的闸门', /停在「发言资格」/.test(g('pipeNote').deepText()), g('pipeNote').deepText().slice(0, 14));

/* 因果滑块推到结构层 */
g('causalRange').value = '2';
sandbox.renderCausal();
check('因果链：起点=0 时责任落点为制度', /制度与资源安排/.test(g('causalDuty').textContent), g('causalDuty').textContent);
const nodes = g('causalChain').children.filter(c => c._cls.has('cause'));
check('因果链：起点=0 时 4 个原因节点', nodes.length === 4, nodes.length);

/* 定义闭合：切换标签 */
g('closureChips').children[2].onclick();
check('定义闭合：切换标签后徽标更新', /不够专业/.test(g('closureBadge').deepText()), g('closureBadge').deepText());
check('定义闭合：切换标签后行数仍为 4', g('closureRows').children.length === 4);

/* canvas 绘制 */
console.log('\n=== 5. canvas 绘制 ===');
let drawThrew = null;
try { sandbox.drawUniverse(); } catch (e) { drawThrew = e; }
check('drawUniverse 无异常', !drawThrew, drawThrew ? drawThrew.message : 'ok');
let expThrew = null;
try { sandbox.startExpand('def'); sandbox.startExpand('exp'); sandbox.startExpand('dis'); } catch (e) { expThrew = e; }
check('展开/收起维度无异常', !expThrew, expThrew ? expThrew.message : 'ok');

console.log('\n=== 6. 结果 ===');
console.log(failures.length === 0 ? 'ALL CHECKS PASSED' : ('FAILED: ' + failures.join(' | ')));
process.exit(failures.length === 0 ? 0 : 1);
