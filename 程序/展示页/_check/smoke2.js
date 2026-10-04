/* 三权理论 展示页 v2 · 运行时冒烟测试
   自带迷你 DOM 解析器 + 选择器引擎，真实执行页面脚本。
   用法: node smoke2.js <page.html> */
const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync(process.argv[2], 'utf8');

/* ============================================================
   1. 迷你 DOM
   ============================================================ */
const VOID = new Set(['br','img','input','meta','link','hr','source','area','base','col','embed','param','track','wbr']);
const RAWTEXT = new Set(['script','style']);

class ClassList {
  constructor(el){ this.el = el; }
  _s(){ return this.el._cls; }
  add(...c){ c.forEach(x => x && this._s().add(x)); }
  remove(...c){ c.forEach(x => this._s().delete(x)); }
  contains(c){ return this._s().has(c); }
  toggle(c, f){
    if (f === undefined){ this._s().has(c) ? this._s().delete(c) : this._s().add(c); }
    else { f ? this._s().add(c) : this._s().delete(c); }
    return this._s().has(c);
  }
}

class El {
  constructor(tag){
    this.tagName = tag.toUpperCase();
    this.tag = tag.toLowerCase();
    this.attrs = {};
    this._cls = new Set();
    this.children = [];
    this.parentNode = null;
    this._text = '';
    this.style = {
      _p: {},
      setProperty(k, v){ this._p[k] = v; },
      getPropertyValue(k){ return this._p[k] || ''; },
      removeProperty(k){ delete this._p[k]; }
    };
    this._handlers = {};
    this.value = '';
    this.width = 0; this.height = 0;
  }
  get classList(){ return new ClassList(this); }
  get className(){ return [...this._cls].join(' '); }
  set className(v){ this._cls = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get id(){ return this.attrs.id || ''; }
  get textContent(){
    if (this.tag === 'script' || this.tag === 'style') return this._text;
    let s = this._text;
    for (const c of this.children) s += c.textContent;
    return s;
  }
  set textContent(v){ this._text = String(v); this.children = []; }
  get innerHTML(){ return this._html != null ? this._html : this._serialize(); }
  set innerHTML(v){
    this._html = String(v);
    this.children = [];
    this._text = '';
    if (v !== '') parseFragment(String(v), this);
  }
  _serialize(){ return this._text + this.children.map(c => c._serialize()).join(''); }
  appendChild(c){ c.parentNode = this; this.children.push(c); return c; }
  removeChild(c){ const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); return c; }
  setAttribute(k, v){ this.attrs[k] = String(v); if (k === 'class') this.className = v; }
  getAttribute(k){ return k in this.attrs ? this.attrs[k] : null; }
  hasAttribute(k){ return k in this.attrs; }
  get type(){ return this.attrs.type || ''; }
  set type(v){ this.attrs.type = String(v); }
  get value(){ return this._value !== undefined ? this._value : (this.attrs.value || ''); }
  set value(v){ this._value = String(v); }
  addEventListener(t, f){ (this._handlers[t] = this._handlers[t] || []).push(f); }
  /* 事件冒泡：从目标逐级向上触发 */
  dispatch(type, ev){
    ev = ev || {};
    if (!ev.target) ev.target = this;
    if (!ev.preventDefault) ev.preventDefault = function(){};
    let n = this;
    while (n){
      const hs = n._handlers[type];
      if (hs) for (const f of hs) f(ev);
      n = n.parentNode;
    }
  }
  getBoundingClientRect(){ return { top: 0, left: 0, width: 1200, height: 700, bottom: 700, right: 1200 }; }
  getContext(){ return mkCtx(); }
  matches(sel){ return sel.split(',').some(s => matchCompound(this, s.trim().split(/\s+/).pop())); }
  closest(sel){
    let n = this;
    while (n){
      if (n.tag !== '#root' && n.matches && n.matches(sel)) return n;
      n = n.parentNode;
    }
    return null;
  }
  querySelector(sel){ const r = this.querySelectorAll(sel); return r.length ? r[0] : null; }
  querySelectorAll(sel){
    const groups = sel.split(',').map(s => s.trim().split(/\s+/));
    const out = [];
    const all = [];
    (function walk(n){ for (const c of n.children){ all.push(c); walk(c); } })(this);
    for (const el of all){
      for (const parts of groups){
        if (matchChain(el, parts)){ out.push(el); break; }
      }
    }
    return out;
  }
  get nextElementSibling(){
    if (!this.parentNode) return null;
    const i = this.parentNode.children.indexOf(this);
    return this.parentNode.children[i + 1] || null;
  }
  get firstElementChild(){ return this.children[0] || null; }
  deepText(){ return this.textContent.replace(/\s+/g, ' ').trim(); }
  /* 递归统计后代 */
  count(tag){
    let n = 0;
    (function walk(x){ for (const c of x.children){ if (!tag || c.tag === tag) n++; walk(c); } })(this);
    return n;
  }
  findAll(sel){ return this.querySelectorAll(sel); }
}

function matchCompound(el, comp){
  if (!comp) return false;
  const m = comp.match(/^([a-zA-Z][\w-]*)?(?:#([\w-]+))?((?:\.[\w-]+)*)((?:\[[^\]]+\])*)$/);
  if (!m) return false;
  const [, tag, id, classes, attrs] = m;
  if (tag && el.tag !== tag.toLowerCase()) return false;
  if (id && el.id !== id) return false;
  if (classes){
    for (const c of classes.split('.').filter(Boolean)) if (!el._cls.has(c)) return false;
  }
  if (attrs){
    for (const a of attrs.match(/\[[^\]]+\]/g) || []){
      const inner = a.slice(1, -1);
      const eq = inner.indexOf('=');
      if (eq < 0){ if (!el.hasAttribute(inner)) return false; }
      else {
        const k = inner.slice(0, eq);
        const v = inner.slice(eq + 1).replace(/^["']|["']$/g, '');
        if (el.getAttribute(k) !== v) return false;
      }
    }
  }
  return true;
}
function matchChain(el, parts){
  if (!matchCompound(el, parts[parts.length - 1])) return false;
  let n = el.parentNode, i = parts.length - 2;
  while (i >= 0){
    if (!n) return false;
    if (matchCompound(n, parts[i])) i--;
    n = n.parentNode;
  }
  return true;
}

/* ============================================================
   2. HTML 解析
   ============================================================ */
function mkCtx(){
  const grad = { addColorStop() {} };
  return new Proxy({}, {
    get(t, k){
      if (k === 'measureText') return s => ({ width: String(s).length * 7.5 });
      if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => grad;
      if (k in t) return t[k];
      return () => {};
    },
    set(t, k, v){ t[k] = v; return true; }
  });
}

const root = new El('#root');
const rawScripts = [];

function parseFragment(src, parent){
  const re = /<!--[\s\S]*?-->|<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>|([^<]+)/g;
  const stack = [parent];
  let m;
  while ((m = re.exec(src))){
    if (m[0].startsWith('<!--')) continue;
    if (m[1]){                                   // 闭合标签
      const tag = m[1].toLowerCase();
      for (let i = stack.length - 1; i > 0; i--){
        if (stack[i].tag === tag){ stack.length = i; break; }
      }
      continue;
    }
    if (m[2]){                                   // 开始标签
      const tag = m[2].toLowerCase();
      const el = new El(tag);
      const attrs = m[3] || '';
      const ar = /([a-zA-Z_:][\w:.-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
      let a;
      while ((a = ar.exec(attrs))){
        const val = a[2] != null ? a[2] : (a[3] != null ? a[3] : (a[4] != null ? a[4] : ''));
        el.setAttribute(a[1], val);
      }
      stack[stack.length - 1].appendChild(el);
      /* canvas 的 width/height 特性在浏览器中会同步为属性 */
      if (tag === 'canvas'){
        el.width = parseInt(el.getAttribute('width') || '300', 10);
        el.height = parseInt(el.getAttribute('height') || '150', 10);
      }
      const selfClose = m[4] === '/';
      if (!selfClose && !VOID.has(tag)) stack.push(el);
      if (RAWTEXT.has(tag)){
        const close = new RegExp('</' + tag + '\\s*>', 'i');
        const rest = src.slice(re.lastIndex);
        const cm = close.exec(rest);
        const body = cm ? rest.slice(0, cm.index) : rest;
        el._text = body;
        rawScripts.push({ tag, text: body });
        re.lastIndex = re.lastIndex + body.length + (cm ? cm[0].length : 0);
        stack.pop();
      }
      continue;
    }
    if (m[5] != null){                           // 文本
      const t = m[5];
      if (t.trim() !== '') stack[stack.length - 1]._text += t.replace(/\s+/g, ' ');
    }
  }
}

/* 只解析 body，head 里的 style/script 单独取 */
const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
const cssText = (html.match(/<style[^>]*>([\s\S]*?)<\/style>/i) || [,''])[1];
const inlineHeadScripts = [...(headMatch ? headMatch[1] : '').matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
const bodyScripts = [...(bodyMatch ? bodyMatch[1] : '').matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
parseFragment(bodyMatch ? bodyMatch[1] : '', root);

/* ============================================================
   3. CSS 变量表
   ============================================================ */
function extractVars(theme){
  const re = new RegExp('\\[data-theme="' + theme + '"\\]\\s*\\{([^}]*)\\}');
  const m = cssText.match(re);
  const out = {};
  if (m){
    for (const pair of m[1].split(';')){
      const i = pair.indexOf(':');
      if (i > 0){
        const k = pair.slice(0, i).trim();
        if (k.startsWith('--')) out[k] = pair.slice(i + 1).trim();
      }
    }
  }
  return out;
}
const VARS = { dark: extractVars('dark'), light: extractVars('light') };

/* ============================================================
   4. document / window / storage
   ============================================================ */
const documentElement = new El('html');
documentElement.setAttribute('data-theme', 'dark');

const document = {
  documentElement,
  body: root,
  getElementById(id){
    const r = root.querySelectorAll('#' + id);
    return r.length ? r[0] : null;
  },
  createElement: t => new El(t),
  querySelector: sel => root.querySelector(sel),
  querySelectorAll: sel => root.querySelectorAll(sel),
  addEventListener() {}
};

let stored = {};
const localStorage = {
  getItem: k => (k in stored ? stored[k] : null),
  setItem: (k, v) => { stored[k] = String(v); },
  removeItem: k => { delete stored[k]; }
};

const intervals = [];
const timeouts = [];
const rafs = [];

const window = {
  innerHeight: 900, innerWidth: 1440,
  scrollY: 0, pageYOffset: 0,
  addEventListener(){}, removeEventListener(){},
  scrollTo(){},
  matchMedia: () => ({ matches: false, addEventListener(){}, addListener(){} }),
  requestAnimationFrame: fn => { rafs.push(fn); return rafs.length; },
  cancelAnimationFrame(){},
  setTimeout: (fn, ms) => { timeouts.push(fn); return timeouts.length; },
  clearTimeout(){},
  setInterval: (fn, ms) => { intervals.push(fn); return intervals.length; },
  clearInterval(id){ if (typeof id === 'number') intervals[id - 1] = null; },
  localStorage
};

const sandbox = {
  document, window, localStorage,
  getComputedStyle(el){
    const theme = (el === documentElement ? documentElement.getAttribute('data-theme') : 'dark') || 'dark';
    const table = VARS[theme] || {};
    return { getPropertyValue: n => (n in table ? table[n] : '') };
  },
  requestAnimationFrame: window.requestAnimationFrame,
  cancelAnimationFrame: window.cancelAnimationFrame,
  setTimeout: window.setTimeout,
  clearTimeout: window.clearTimeout,
  setInterval: window.setInterval,
  clearInterval: window.clearInterval,
  matchMedia: window.matchMedia,
  IntersectionObserver: class { constructor(){} observe(){} unobserve(){} disconnect(){} },
  console, Math, Object, Array, String, Number, JSON, Date, RegExp,
  parseInt, parseFloat, isNaN, NaN, Infinity, Boolean, Error, Set, Map, Symbol, Promise
};
sandbox.globalThis = sandbox;

/* ============================================================
   5. 执行页面脚本
   ============================================================ */
const failures = [];
function check(name, cond, extra){
  const ok = !!cond;
  console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (extra !== undefined ? '  → ' + extra : ''));
  if (!ok) failures.push(name);
}
function section(t){ console.log('\n=== ' + t + ' ==='); }

section('1. 脚本执行');
let threw = null;
try {
  inlineHeadScripts.forEach((s, i) => vm.runInNewContext(s, sandbox, { filename: 'head' + i + '.js' }));
  bodyScripts.forEach((s, i) => vm.runInNewContext(s, sandbox, { filename: 'body' + i + '.js' }));
} catch (e){ threw = e; }
check('页面脚本执行无异常', !threw, threw ? threw.message : 'ok');
if (threw){ console.log(threw.stack); process.exit(1); }
check('主题脚本设置了 data-theme', ['dark','light'].includes(documentElement.getAttribute('data-theme')),
      documentElement.getAttribute('data-theme'));
check('CSS 变量表可读（dark/light）',
      Object.keys(VARS.dark).length > 10 && Object.keys(VARS.light).length > 10,
      'dark=' + Object.keys(VARS.dark).length + ' light=' + Object.keys(VARS.light).length);

section('2. 章节与导航');
const chaps = root.querySelectorAll('.chap');
check('13 个章节容器', chaps.length === 13, chaps.length);
const railLinks = root.querySelectorAll('.rail a');
check('导轨 13 个条目', railLinks.length === 13, railLinks.length);
const railOk = railLinks.every(a => chaps.some(c => c.getAttribute('data-c') === a.getAttribute('data-c')));
check('导轨与章节 data-c 一一对应', railOk);

section('3. 交互块挂载');
const figs = root.querySelectorAll('.ix');
check('16 个交互块', figs.length === 16, figs.length);
let empty = [], kinds = {};
figs.forEach(f => {
  const t = f.getAttribute('data-ix'), id = f.getAttribute('data-id');
  kinds[t] = (kinds[t] || 0) + 1;
  const b = f.querySelector('.ix-body');
  if (!b || b.children.length === 0) empty.push(id);
});
check('每个交互块都渲染出内容', empty.length === 0, empty.length ? '空:' + empty.join(',') : 'ok');
check('交互类型分布', true, JSON.stringify(kinds));
const noteCount = root.querySelectorAll('.ix-note').length;
check('渲染器写入了说明区', noteCount >= 6, noteCount + ' 个 .ix-note');

function figOf(id){
  return figs.find(f => f.getAttribute('data-id') === id);
}
function clickNode(el){ el.dispatch('click', { target: el }); }

section('4. 传导链 (chain)');
/* remove 模式 */
const fRoute = figOf('route');
let nodes = fRoute.querySelector('.ix-body').querySelectorAll('.ch-node');
check('总传导链 5 环', nodes.length === 5, nodes.length);
const noteOf = f => f.querySelector('.ix-note');
const before = noteOf(fRoute).deepText();
clickNode(nodes[2]);
check('点击环节后标记为 removed', nodes[2]._cls.has('dead'));
check('说明文字随之改变', noteOf(fRoute).deepText() !== before && noteOf(fRoute).deepText().length > 10,
      noteOf(fRoute).deepText().slice(0, 18));
clickNode(nodes[2]);
check('再次点击恢复', !nodes[2]._cls.has('dead'));
/* inspect 模式 */
const fSteps = figOf('four-steps');
let sn = fSteps.querySelector('.ix-body').querySelectorAll('.ch-node');
check('定义四步 4 环', sn.length === 4, sn.length);
clickNode(sn[1]);
const sel = fSteps.querySelector('.ix-body').querySelectorAll('.ch-node').filter(n => n._cls.has('on'));
check('inspect 模式单选高亮', sel.length === 1, sel.length);
check('inspect 模式说明已填充', noteOf(fSteps).deepText().length > 20);
/* gate 模式 */
const fPipe = figOf('pipe');
let gn = fPipe.querySelector('.ix-body').querySelectorAll('.ch-node');
check('传播链 5 道闸门', gn.length === 5, gn.length);
clickNode(gn[2]);
let gn2 = fPipe.querySelector('.ix-body').querySelectorAll('.ch-node');
check('受阻闸门加 blocked', gn2[2]._cls.has('blocked'));
check('后续闸门置灰', gn2[3]._cls.has('dim') && gn2[4]._cls.has('dim'));
check('说明指向受阻位置', /停在/.test(noteOf(fPipe).deepText()), noteOf(fPipe).deepText().slice(0, 10));
clickNode(gn2[0]);
let gn3 = fPipe.querySelector('.ix-body').querySelectorAll('.ch-node');
check('叠加受阻后停在更早闸门', gn3[0]._cls.has('blocked') && /发言资格/.test(noteOf(fPipe).deepText()));
check('同时受阻时后者置灰', gn3[2]._cls.has('dim'));

section('5. 状态机 (stepper) 全 8 状态');
const fT = figOf('triad');
const swBtns = fT.querySelector('.ix-body').querySelectorAll('.st-sw');
check('三个开关', swBtns.length === 3, swBtns.length);
const TBL = {
  '100': ['仅掌握定义权','单权状态'], '010': ['仅掌握解释权','单权状态'], '001': ['仅掌握话语权','单权状态'],
  '110': ['定义权 ＋ 解释权','两权主导'], '101': ['定义权 ＋ 话语权','两权主导'], '011': ['解释权 ＋ 话语权','两权主导'],
  '111': ['三权齐备','闭环控制'], '000': ['认知消灭','三权尽失']
};
Object.keys(TBL).forEach(key => {
  /* 从当前状态出发，逐位切换 */
  const cur = fT.querySelector('.ix-body')._state;
  if (cur !== key){
    for (let i = 0; i < 3; i++){
      if (cur[i] !== key[i]) clickNode(swBtns[i]);
      /* cur 已变，重新读 */
      const now = fT.querySelector('.ix-body')._state;
      if (now === key) break;
    }
  }
  const state = fT.querySelector('.ix-body')._state;
  const title = fT.querySelector('.st-title').textContent;
  const tag = fT.querySelector('.st-tag').textContent;
  const cells = fT.querySelectorAll('.st-cell .v');
  const lens = cells.map(c => c.textContent.trim().length);
  const filled = cells.length === 3 && lens.every(n => n >= 3);
  check(key + ' → ' + TBL[key][0] + ' / ' + TBL[key][1],
        state === key && title === TBL[key][0] && tag === TBL[key][1] && filled,
        state + ' | ' + title + ' | ' + tag + ' | cells=' + cells.length + ' lens=' + lens.join(','));
});

section('6. 滑块 (slider)');
const fCausal = figOf('causal');
const cRange = fCausal.querySelector('input[type=range]');
check('因果滑块存在', !!cRange, cRange && cRange.min + '–' + cRange.max);
check('因果滑块默认第 1 档结论', fCausal.deepText().includes('个人失误'));
cRange.value = '2';
cRange.dispatch('input', {});
check('拖到第 3 档 → 结论为组织机制', fCausal.deepText().includes('组织机制长期运行的结果'), '');
check('责任落点同步变化', fCausal.deepText().includes('制度与资源安排'));
const causeNodes = fCausal.querySelector('.ix-body').querySelectorAll('.ch-node');
check('因果链 5 个节点', causeNodes.length === 5, causeNodes.length);

const fExc = figOf('exception');
const eRange = fExc.querySelector('input[type=range]');
check('例外滑块存在', !!eRange, eRange && eRange.min + '–' + eRange.max);
eRange.value = '1'; eRange.dispatch('input', {});
const lowTxt = fExc.deepText();
check('低档位显示「个别情况」', lowTxt.includes('个别情况'));
eRange.value = '12'; eRange.dispatch('input', {});
const hiTxt = fExc.deepText();
check('高档位显示「定义危机」', hiTxt.includes('定义危机'));
check('高档位 zone 加 hot 标记', fExc.querySelector('.sl-zone')._cls.has('hot'));
const gauges = fExc.querySelectorAll('.sl-gauge');
check('两个仪表已渲染', gauges.length === 2, gauges.length);
const bars = fExc.querySelectorAll('.bar i');
check('仪表宽度已写入', bars.length === 2 && bars.every(b => /width:\s*\d+/.test(b.getAttribute('style') || '')),
      bars.map(b => b.getAttribute('style')).join(' | '));

const fFreq = figOf('frequency');
const qRange = fFreq.querySelector('input[type=range]');
qRange.value = '8'; qRange.dispatch('input', {});
check('频次低档 → 几乎没有留下印象', fFreq.deepText().includes('几乎没有留下印象'));
qRange.value = '100'; qRange.dispatch('input', {});
check('频次高档 → 逆反', fFreq.deepText().includes('逆反'));
check('频次高档 zone 加 hot', fFreq.querySelector('.sl-zone')._cls.has('hot'));

section('7. 选择器 (picker)');
['formal','levels','naming','audience'].forEach(id => {
  const f = figOf(id);
  const tabs = f.querySelectorAll('.pk-tab');
  check(id + ' → 选项卡数量 ' + tabs.length, tabs.length >= 4, tabs.length);
  const firstTitle = f.querySelector('.pk-title').deepText();
  clickNode(tabs[1]);
  const secondTitle = f.querySelector('.pk-title').deepText();
  const rows = f.querySelectorAll('.pk-r');
  check(id + ' → 切换后内容变化且行已填充',
        secondTitle !== firstTitle && rows.length >= 3 && rows.every(r => r.deepText().length > 5),
        rows.length + ' 行');
});

section('8. 矩阵 (matrix)');
const fMx = figOf('combos');
const mCells = fMx.querySelectorAll('.mx-cell');
check('三列 × 三行 = 9 个格子', mCells.length === 9, mCells.length);
check('格子内容已填充', mCells.every(c => c.deepText().length > 8));
const mHead = fMx.querySelectorAll('.mx-h');
check('表头 4 个（角 + 3 列）+ 3 行名', mHead.length === 7, mHead.length);

section('9. 推演 (sim)');
['absorb','loop'].forEach(id => {
  const f = figOf(id);
  const steps = f.querySelectorAll('.sm-step');
  const btns = f.querySelectorAll('.btn');
  check(id + ' → 阶段数 ' + steps.length, steps.length >= 4, steps.length);
  check(id + ' → 三个控制按钮', btns.length === 3, btns.length);
  const intro = f.querySelector('.sm-stage').deepText();
  clickNode(btns[1]);   /* 下一步 */
  const s1 = f.querySelector('.sm-stage').deepText();
  clickNode(btns[1]);
  const s2 = f.querySelector('.sm-stage').deepText();
  check(id + ' → 「下一步」推进阶段', s1 !== intro && s2 !== s1);
  const on = f.querySelectorAll('.sm-step').filter(x => x._cls.has('on'));
  check(id + ' → 当前阶段高亮唯一', on.length === 1, on.length);
  clickNode(btns[2]);   /* 重置 */
  check(id + ' → 重置回到待运行', f.querySelector('.sm-stage').deepText() === intro);
  const dots = f.querySelectorAll('.sm-dots i');
  check(id + ' → 进度点数量与阶段一致', dots.length === steps.length, dots.length);
});

section('10. 定义闭合 (closure)');
const fC = figOf('closure');
const cTabs = fC.querySelectorAll('.pk-tab');
check('四个标签', cTabs.length === 4, cTabs.length);
const badge0 = fC.querySelector('.badge').deepText();
check('徽标显示初始标签', badge0.includes('不理性'), badge0);
clickNode(cTabs[2]);
const badge1 = fC.querySelector('.badge').deepText();
const cRows = fC.querySelectorAll('.row');
check('切换标签后徽标更新', badge1.includes('不够专业') && badge1 !== badge0, badge1);
check('反应行始终 4 条', cRows.length === 4, cRows.length);
check('说明区已填充', noteOf(fC).deepText().length > 20);

section('11. canvas 图版');
let drawErr = null;
try { sandbox.drawAtlas(); } catch (e){ drawErr = e; }
check('drawAtlas 无异常', !drawErr, drawErr ? drawErr.message : 'ok');
const cant = document.getElementById('atlas');
check('canvas 元素存在且尺寸正确', !!cant && cant.width === 960 && cant.height === 700,
      cant ? cant.width + 'x' + cant.height : 'missing');
let expErr = null;
try { sandbox.startExpand('def'); sandbox.startExpand('exp'); sandbox.startExpand('dis'); } catch (e){ expErr = e; }
check('展开/收起维度无异常', !expErr, expErr ? expErr.message : 'ok');
let entErr = null;
try {
  sandbox.atlasPhase = 0;
  for (let i = 0; i < 40; i++) sandbox.drawAtlas();
} catch (e){ entErr = e; }
check('入场动画路径无异常', !entErr, entErr ? entErr.message : 'ok');

section('12. 主题切换');
const themeBtn = document.getElementById('themeBtn');
check('主题按钮存在', !!themeBtn);
check('初始图标为 ☀（深色）', themeBtn.textContent === '☀', themeBtn.textContent);
let togErr = null;
try { clickNode(themeBtn); } catch (e){ togErr = e; }
check('切换无异常', !togErr, togErr ? togErr.message : 'ok');
check('data-theme 变为 light', documentElement.getAttribute('data-theme') === 'light',
      documentElement.getAttribute('data-theme'));
check('图标变为 ☾', themeBtn.textContent === '☾', themeBtn.textContent);
check('偏好已写入 localStorage', stored['sanchuan-theme'] === 'light', JSON.stringify(stored));
let redrawErr = null;
try { sandbox.drawAtlas(); } catch (e){ redrawErr = e; }
check('浅色下重绘无异常', !redrawErr, redrawErr ? redrawErr.message : 'ok');
clickNode(themeBtn);
check('再次切换回到 dark', documentElement.getAttribute('data-theme') === 'dark');

section('13. 结果');
console.log(failures.length === 0 ? 'ALL CHECKS PASSED' : ('FAILED ' + failures.length + ': ' + failures.join(' | ')));
process.exit(failures.length === 0 ? 0 : 1);
