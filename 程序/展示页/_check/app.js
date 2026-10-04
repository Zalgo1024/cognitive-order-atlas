
/* 防闪烁：首次绘制前定主题 */
(function(){
  try{
    var t = localStorage.getItem('sanchuan-theme');
    if (t !== 'light' && t !== 'dark'){
      t = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    document.documentElement.setAttribute('data-theme', t);
  }catch(e){ document.documentElement.setAttribute('data-theme','dark'); }
})();


/* ============================================================
   三权理论 展示页 v2 · 交互脚本
   零外部依赖 · 声明式交互原语
   ============================================================ */
'use strict';

/* ---------------- 主题 ---------------- */
var THEME_KEY = 'sanchuan-theme';

function applyTheme(t){
  document.documentElement.setAttribute('data-theme', t);
  var b = document.getElementById('themeBtn');
  if (b) b.textContent = (t === 'light') ? '☾' : '☀';
  if (typeof drawAtlas === 'function') drawAtlas();
}

function initTheme(){
  var b = document.getElementById('themeBtn');
  if (!b) return;
  b.addEventListener('click', function(){
    var now = document.documentElement.getAttribute('data-theme');
    var next = (now === 'light') ? 'dark' : 'light';
    applyTheme(next);
    try{ localStorage.setItem(THEME_KEY, next); }catch(e){}
  });
  try{
    if (window.matchMedia){
      window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', function(e){
        var saved = null;
        try{ saved = localStorage.getItem(THEME_KEY); }catch(err){}
        if (!saved) applyTheme(e.matches ? 'light' : 'dark');
      });
    }
  }catch(e){}
  /* 同步按钮图标 */
  applyTheme(document.documentElement.getAttribute('data-theme') || 'dark');
}

/* ---------------- 折叠 ---------------- */
function toggleFold(btn){
  var body = btn.nextElementSibling;
  if (!body || !body.classList.contains('fold')) return;
  var open = body.classList.toggle('on');
  btn.classList.toggle('on', open);
}

/* ---------------- 滚动导航 ---------------- */
var CHAPS = [];
function initNav(){
  var secs = document.querySelectorAll('.chap');
  for (var i = 0; i < secs.length; i++) CHAPS.push(secs[i]);

  var railLinks = document.querySelectorAll('.rail a');
  var tbNum = document.getElementById('tbNum'),
      tbTitle = document.getElementById('tbTitle'),
      tbCount = document.getElementById('tbCount'),
      bar = document.getElementById('tbProgress');

  function update(){
    var y = window.scrollY || window.pageYOffset;
    var idx = 0;
    for (var i = 0; i < CHAPS.length; i++){
      if (CHAPS[i].offsetTop - 96 <= y) idx = i;
    }
    if (idx > CHAPS.length - 1) idx = CHAPS.length - 1;
    var sec = CHAPS[idx];
    for (var r = 0; r < railLinks.length; r++){
      railLinks[r].classList.toggle('on', railLinks[r].getAttribute('data-c') === sec.getAttribute('data-c'));
    }
    if (tbNum) tbNum.textContent = ('0' + sec.getAttribute('data-c')).slice(-2);
    if (tbTitle) tbTitle.textContent = sec.getAttribute('data-title') || '';
    if (tbCount) tbCount.textContent = (idx + 1) + ' / ' + CHAPS.length;
    if (bar){
      var h = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = (h > 0 ? Math.min(100, Math.max(0, (y / h) * 100)) : 0) + '%';
    }
  }

  var tick = false;
  window.addEventListener('scroll', function(){
    if (tick) return;
    tick = true;
    requestAnimationFrame(function(){ update(); tick = false; });
  }, { passive: true });
  window.addEventListener('resize', update);
  update();
}

/* ---------------- 移动端抽屉 ---------------- */
function initDrawer(){
  var btn = document.getElementById('menuBtn');
  var rail = document.getElementById('rail');
  var scrim = document.getElementById('scrim');
  if (!btn || !rail || !scrim) return;
  function close(){ rail.classList.remove('open'); scrim.classList.remove('on'); }
  btn.addEventListener('click', function(){
    rail.classList.toggle('open');
    scrim.classList.toggle('on', rail.classList.contains('open'));
  });
  scrim.addEventListener('click', close);
  var links = rail.querySelectorAll('a');
  for (var i = 0; i < links.length; i++) links[i].addEventListener('click', close);
}

/* ---------------- 滚动显现 ---------------- */
function initReveal(){
  var els = document.querySelectorAll('.rv');
  if (!('IntersectionObserver' in window)){
    for (var i = 0; i < els.length; i++) els[i].classList.add('on');
    return;
  }
  var ob = new IntersectionObserver(function(entries){
    entries.forEach(function(e){ if (e.isIntersecting) e.target.classList.add('on'); });
  }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });
  for (var j = 0; j < els.length; j++) ob.observe(els[j]);
}

/* ============================================================
   交互原语渲染器
   ============================================================ */
function el(tag, cls, html){
  var d = document.createElement(tag);
  if (cls) d.className = cls;
  if (html != null) d.innerHTML = html;
  return d;
}
function noteOf(body, html){
  var n = body.parentNode.querySelector('.ix-note');
  if (!n){ n = el('div','ix-note'); body.parentNode.appendChild(n); }
  n.innerHTML = html || '';
}

/* ---- P1 传导链 ---- */
function renderChain(spec, body){
  var wrap = el('div');
  var row = el('div','ch-row');
  var NOTE_DEFAULT = spec.note || '';

  for (var i = 0; i < spec.nodes.length; i++){
    if (i > 0) row.appendChild(el('span','ch-arrow','→'));
    var nd = spec.nodes[i];
    var b = el('button','ch-node' + (nd.cls ? ' ' + nd.cls : ''),
               (nd.k ? '<span class="ci">' + nd.k + '</span>' : '') + nd.n);
    b.setAttribute('data-i', i);
    row.appendChild(b);
  }
  wrap.appendChild(row);
  body.appendChild(wrap);
  noteOf(body, NOTE_DEFAULT);

  function refresh(){
    var firstBlocked = -1;
    if (spec.mode === 'gate'){
      for (var g = 0; g < spec.nodes.length; g++){
        if (spec.nodes[g]._off){ firstBlocked = g; break; }
      }
    }
    var btns = row.querySelectorAll('.ch-node');
    for (var j = 0; j < btns.length; j++){
      var s = spec.nodes[j], cls = 'ch-node' + (s.cls ? ' ' + s.cls : '');
      if (spec.mode === 'gate'){
        if (j === firstBlocked) cls += ' blocked';
        else if (firstBlocked >= 0 && j > firstBlocked) cls += ' dim';
      } else if (spec.mode === 'remove'){
        if (s._off) cls += ' dead';
      } else {
        if (s._on) cls += ' on';
      }
      btns[j].className = cls;
    }
    if (spec.mode === 'gate'){
      noteOf(body, firstBlocked < 0 ? (spec.allOpen || NOTE_DEFAULT) : spec.stop[firstBlocked]);
    } else if (spec.mode === 'remove'){
      var off = null;
      for (var m = 0; m < spec.nodes.length; m++) if (spec.nodes[m]._off) off = spec.nodes[m];
      noteOf(body, off ? off.m : NOTE_DEFAULT);
    } else {
      var on = null;
      for (var n2 = 0; n2 < spec.nodes.length; n2++) if (spec.nodes[n2]._on) on = spec.nodes[n2];
      noteOf(body, on ? on.d : NOTE_DEFAULT);
    }
  }

  row.addEventListener('click', function(e){
    var t = e.target.closest ? e.target.closest('.ch-node') : null;
    if (!t) return;
    var i = parseInt(t.getAttribute('data-i'), 10);
    var s = spec.nodes[i];
    if (spec.mode === 'gate'){ s._off = !s._off; }
    else if (spec.mode === 'remove'){ s._off = !s._off; }
    else {
      var was = s._on;
      for (var k = 0; k < spec.nodes.length; k++) spec.nodes[k]._on = false;
      s._on = !was;
    }
    refresh();
  });
  refresh();
}

/* ---- P2 开关状态机 ---- */
function renderStepper(spec, body){
  var swWrap = el('div','st-switches');
  var panel = el('div','st-panel');
  panel.innerHTML =
    '<div class="st-top"><span class="st-tag"></span><span class="st-title"></span></div>' +
    '<div class="st-body">' +
      '<div class="st-cell"><div class="k">能够做到</div><div class="v" data-f="can"></div></div>' +
      '<div class="st-cell"><div class="k">卡在哪里</div><div class="v" data-f="stuck"></div></div>' +
      '<div class="st-cell"><div class="k">所处状态</div><div class="v" data-f="state"></div></div>' +
    '</div>' +
    '<div class="st-foot"></div>';

  var sw = {};
  spec.dims.forEach(function(d){
    var b = el('button','st-sw');
    b.style.setProperty('--c', 'var(' + d.color + ')');
    b.style.setProperty('--c-w', 'var(' + d.color + '-w)');
    b.innerHTML = '<span class="r1"><span class="nm">' + d.name + '</span><span class="led">' + d.led + '</span></span>' +
                  '<span class="q">' + d.q + '</span>';
    b.addEventListener('click', function(){ st[d.k] = !st[d.k]; paint(); });
    swWrap.appendChild(b);
    sw[d.k] = b;
  });

  body.appendChild(swWrap);
  body.appendChild(panel);

  var st = {};
  spec.dims.forEach(function(d){ st[d.k] = spec.init.indexOf(d.k) >= 0; });

  function paint(){
    spec.dims.forEach(function(d){ sw[d.k].classList.toggle('on', st[d.k]); });
    var key = spec.dims.map(function(d){ return st[d.k] ? '1' : '0'; }).join('');
    var s = spec.states[key];
    if (!s) return;
    var tag = panel.querySelector('.st-tag'),
        title = panel.querySelector('.st-title'),
        foot = panel.querySelector('.st-foot');
    tag.textContent = s.tag;
    tag.style.setProperty('--pc', 'var(' + s.color + ')');
    title.textContent = s.title;
    panel.querySelector('[data-f="can"]').innerHTML = s.can;
    panel.querySelector('[data-f="stuck"]').innerHTML = s.stuck;
    panel.querySelector('[data-f="state"]').innerHTML = s.state;
    foot.innerHTML = s.foot;
    body._state = key;
  }
  paint();
}

/* ---- P3 滑块 ---- */
function renderSlider(spec, body){
  body.style.setProperty('--acc', 'var(' + spec.acc + ')');

  var input = document.createElement('input');
  input.type = 'range';
  input.min = spec.min; input.max = spec.max; input.step = spec.step || 1;
  input.value = spec.value;
  input.setAttribute('aria-label', spec.label || '参数');
  body.appendChild(input);

  if (spec.ticks){
    var tk = el('div','sl-ticks');
    tk.innerHTML = spec.ticks.map(function(t){ return '<span>' + t + '</span>'; }).join('');
    body.appendChild(tk);
  }

  var host = el('div');
  body.appendChild(host);

  function paint(){
    var v = parseInt(input.value, 10);
    if (spec.ticks){
      var spans = body.querySelectorAll('.sl-ticks span');
      for (var i = 0; i < spans.length; i++){
        spans[i].classList.toggle('hi', spec.kind === 'discrete'
          ? i === v
          : (i === 2 ? v > spec.hotFrom : (i === 1 ? v > spec.warmFrom && v <= spec.hotFrom : v <= spec.warmFrom)));
      }
    }
    host.innerHTML = '';

    if (spec.kind === 'discrete'){
      var s = spec.steps[v];
      if (s.chain){
        var row = el('div','sl-row');
        s.chain.nodes.forEach(function(n, i){
          if (i > 0) row.appendChild(el('span','sep','→'));
          var cls = 'ch-node';
          if (i === s.chain.nodes.length - 1) cls += ' dis';
          else if (i < s.chain.causeFrom) cls += ' exp dead';
          else cls += ' exp';
          row.appendChild(el('span', cls, n));
        });
        host.appendChild(row);
      }
      if (s.cards){
        var out = el('div','sl-out');
        s.cards.forEach(function(c){
          out.appendChild(el('div','sl-card','<div class="k">' + c.k + '</div><div class="v">' + c.v + '</div>'));
        });
        host.appendChild(out);
      }
      if (s.note) host.appendChild(el('div','sl-zone', s.note));
    } else {
      if (spec.gauges){
        spec.gauges.forEach(function(g){
          var val = g.get(v);
          var box = el('div','sl-gauge');
          box.innerHTML = '<div class="gl"><span>' + g.label + '</span><b>' + val + ' / 100</b></div>' +
                          '<div class="bar ' + (g.bar || 'b') + '"><i style="width:' + val + '%"></i></div>';
          host.appendChild(box);
        });
      }
      var z = null;
      for (var zi = 0; zi < spec.zones.length; zi++){
        if (v <= spec.zones[zi].max){ z = spec.zones[zi]; break; }
      }
      if (!z) z = spec.zones[spec.zones.length - 1];
      var zz = el('div','sl-zone' + (z.hot ? ' hot' : ''), z.text);
      host.appendChild(zz);
    }
    body._value = v;
  }

  input.addEventListener('input', paint);
  paint();
}

/* ---- P4a 选择器 ---- */
function renderPicker(spec, body){
  var tabs = el('div','pk-tabs');
  var panel = el('div','pk-panel');
  body.appendChild(tabs);
  body.appendChild(panel);
  var cur = 0;

  function paint(){
    tabs.innerHTML = '';
    spec.items.forEach(function(it, i){
      var b = el('button','pk-tab' + (i === cur ? ' on' : ''), it.label);
      b.addEventListener('click', function(){ cur = i; paint(); });
      tabs.appendChild(b);
    });
    var it = spec.items[cur];
    panel.innerHTML =
      '<div class="pk-title">' + (it.code ? '<span class="pk-c">' + it.code + '</span>' : '') + it.title + '</div>' +
      '<div class="pk-rows">' + it.rows.map(function(r){
        return '<div class="pk-r"><div class="k">' + r[0] + '</div><div class="v">' + r[1] + '</div></div>';
      }).join('') + '</div>';
  }
  paint();
}

/* ---- P4b 矩阵 ---- */
function renderMatrix(spec, body){
  var grid = el('div','mx-grid');
  var n = spec.cols.length;
  grid.style.gridTemplateColumns = 'minmax(72px,96px) repeat(' + n + ', minmax(0,1fr))';

  grid.appendChild(el('div','mx-h',''));
  spec.cols.forEach(function(c){ grid.appendChild(el('div','mx-h', c)); });

  spec.rows.forEach(function(rname, ri){
    grid.appendChild(el('div','mx-h', rname));
    spec.cols.forEach(function(c, ci){
      var cell = el('div','mx-cell', '<span class="t"></span>' + spec.cells[ri][ci]);
      grid.appendChild(cell);
    });
  });

  body.appendChild(grid);
  var note = el('div','ix-note');
  if (spec.note) note.innerHTML = spec.note;
  body.parentNode.appendChild(note);
  if (spec.extra){
    var ex = el('div','ix-note');
    ex.innerHTML = spec.extra;
    body.parentNode.appendChild(ex);
  }
}

/* ---- P5 推演 ---- */
function renderSim(spec, body){
  var ctrl = el('div','sm-ctrl');
  var playBtn = el('button','btn pri', '▶ 推演');
  var nextBtn = el('button','btn', '下一步');
  var resetBtn = el('button','btn', '重置');
  ctrl.appendChild(playBtn); ctrl.appendChild(nextBtn); ctrl.appendChild(resetBtn);

  var stepsRow = el('div','sm-steps');
  var stage = el('div','sm-stage');
  var dots = el('div','sm-dots');

  body.appendChild(ctrl);
  body.appendChild(stepsRow);
  body.appendChild(stage);
  body.appendChild(dots);

  var idx = -1, timer = null;

  spec.steps.forEach(function(s, i){
    var b = el('button','sm-step');
    b.style.setProperty('--c', 'var(' + (s.color || spec.color || '--def') + ')');
    b.style.setProperty('--c-w', 'var(' + (s.color || spec.color || '--def') + '-w)');
    b.innerHTML = '<span class="sn">阶段 0' + (i + 1) + '</span><span class="st">' + s.t + '</span>';
    b.addEventListener('click', function(){ stop(); idx = i; paint(); });
    stepsRow.appendChild(b);
    dots.appendChild(el('i'));
  });

  function paint(){
    var sb = stepsRow.querySelectorAll('.sm-step');
    for (var i = 0; i < sb.length; i++){
      sb[i].classList.toggle('on', i === idx);
      sb[i].classList.toggle('done', i < idx);
    }
    var db = dots.querySelectorAll('i');
    for (var j = 0; j < db.length; j++) db[j].classList.toggle('on', j <= idx);

    if (idx < 0){
      stage.innerHTML = '<div class="sh"><span class="sg">待运行</span>' + (spec.introTitle || '点「推演」开始') + '</div>' +
                        '<div class="sb">' + (spec.intro || '') + '</div>';
    } else {
      var s = spec.steps[idx];
      stage.style.setProperty('--c', 'var(' + (s.color || spec.color || '--def') + ')');
      stage.innerHTML = '<div class="sh"><span class="sg">阶段 0' + (idx + 1) + '</span>' + s.title + '</div>' +
                        '<div class="sb">' + s.text + '</div>';
    }
    body._step = idx;
  }
  function stop(){ if (timer){ clearInterval(timer); timer = null; playBtn.textContent = '▶ 推演'; } }
  function step(){ if (idx < spec.steps.length - 1){ idx++; paint(); } else stop(); }

  playBtn.addEventListener('click', function(){
    if (timer){ stop(); return; }
    if (idx >= spec.steps.length - 1) idx = -1;
    playBtn.textContent = '⏸ 暂停';
    step();
    timer = setInterval(step, spec.interval || 2600);
  });
  nextBtn.addEventListener('click', function(){ stop(); step(); });
  resetBtn.addEventListener('click', function(){ stop(); idx = -1; paint(); });
  paint();
}

/* ---- 定义闭合 ---- */
function renderClosure(spec, body){
  var chips = el('div','pk-tabs');
  var badge = el('div','badge');
  var rows = el('div','rows');
  body.appendChild(chips); body.appendChild(badge); body.appendChild(rows);
  var cur = spec.order[0];

  function paint(){
    chips.innerHTML = '';
    spec.order.forEach(function(k){
      var b = el('button','pk-tab' + (k === cur ? ' on' : ''), k);
      b.addEventListener('click', function(){ cur = k; paint(); });
      chips.appendChild(b);
    });
    badge.innerHTML = '对象被定义为 <b>「' + cur + '」</b>';
    var d = spec.sets[cur];
    rows.innerHTML = d.rows.map(function(r, i){
      return '<div class="row" style="animation-delay:' + (i * 80) + 'ms"><span class="rk">' + r[0] + '</span>' +
             '<span class="rv2">' + r[1] + '</span></div>';
    }).join('');
    noteOf(body, d.note);
  }
  paint();
}

/* ============================================================
   交互规格数据（全部取自原书）
   ============================================================ */
var SPECS = {

/* ---------- 导论 ---------- */
route: {
  mode: 'remove',
  note: '这条链上每一环都不可跳过。点击任一环节，看它被拿掉之后会发生什么。',
  nodes: [
    { n: '事实', m: '事实本身不会消失，但它无法被识别为「值得讨论的事实」，只能停留在当事人和记录里。' },
    { n: '识别与命名', m: '没有名称，对象就无法进入讨论。它仍然存在，却不是一个可以被谈论的东西。' },
    { n: '置入因果与意义', m: '事实之间的先后、因果和主次无法确定，受众只能得到一堆彼此无关的材料。' },
    { n: '渠道与抵达', m: '定义和解释无法离开提出者，多数人根本不会接触到这个版本。' },
    { n: '社会认知', m: '到不了这一步，前面所有环节的工作都不会沉淀为稳定的公共认识。' }
  ]
},

formal: { items: [
  { label: '有正式定义权而无社会承认', code: '错配 01', title: '法规给出了名称，人们继续用另一个称呼',
    rows: [
      ['平时看到', '制度文本使用「无障碍设施」，使用者和家属说的是「怕台阶」；统计口径把某种工作算作「灵活就业」，从业者自己说「打零工」。'],
      ['实际状态', '<b>法定名称在执行上有效，在认知上却是空的。</b>这说明定义权被分成两层：能不能进入程序是一回事，能不能成为人们认识对象时的默认起点是另一回事。'],
      ['它提示', '权力改变的是进入门槛和代价结构，三权是否生效取决于承认。']
    ] },
  { label: '有解释资格而无信任', code: '错配 02', title: '有权作出结论，却没人把结论当作判断依据',
    rows: [
      ['平时看到', '结论进入档案，却没有进入判断。'],
      ['实际状态', '最典型的表现是同一件事长期存在<b>两套并行版本</b>：一套用于正式场合，一套用于私下交谈。'],
      ['它提示', '解释权名义上存在，实际效力被抽空。程序上的终结，与认知上的终结是两件事。']
    ] },
  { label: '有渠道而无概念', code: '错配 03', title: '发布能力充足，却始终在转述别人的说法',
    rows: [
      ['平时看到', '它的频道、版面、账号都在运转，用词却来自外部，问题也由外部设定。'],
      ['实际状态', '表面上它在说话，实际上它只是<b>替别人扩大音量</b>。话语权重在「使自己的说法抵达受众」，一个没有自己定义和解释的渠道，很难满足这个条件。'],
      ['它提示', '渠道是条件，不是内容。有渠道不等于有份额。']
    ] },
  { label: '有强制而无解释', code: '错配 04', title: '能让一种说法被公开重复，却不能让它被用来理解事情',
    rows: [
      ['平时看到', '重复带来的是熟悉，而不是自洽。'],
      ['实际状态', '人们知道官方怎么说，也知道自己怎么看，<b>两者并行而不相交</b>。'],
      ['它提示', '强制对话语权的效果最直接，对定义权与解释权几乎无效——定义与解释的生效都需要受众的配合，而配合不能被强迫生产。']
    ] }
]},

levels: { items: [
  { label: '个体', code: '层次 01 · 个体', title: '能否定义自己的身份与处境',
    rows: [
      ['三权表现', '个人能否定义自己的身份与处境，能否解释自身行为，能否使自己的说法被他人听见。'],
      ['形成条件', '个体并非只能被动接受外部定义，但个体的自我定义也不一定能够得到家庭、组织和社会的承认。'],
      ['失效方式', '自我定义无法转化为他人使用的概念，只能停留在私人陈述里。']
    ] },
  { label: '群体', code: '层次 02 · 群体', title: '谁属于「我们」，谁来说明共同利益',
    rows: [
      ['三权表现', '参与群体边界和共同身份的形成：判断谁属于「我们」，谁属于「他们」，什么经历能够代表群体，又由谁说明群体的共同利益。'],
      ['形成条件', '需要共同经历、共同威胁与共同未来的叙述，也需要能够代表群体的发言位置。'],
      ['失效方式', '许多群体冲突由身份定义、代表资格和历史解释之间的竞争推动，具体利益往往只是它的表面形式。']
    ] },
  { label: '组织', code: '层次 03 · 组织', title: '内部发生了什么，由谁负责，如何对外说明',
    rows: [
      ['三权表现', '规则制定、信息汇报、责任归因和对外表达。组织不仅要决定内部发生了什么，还要决定哪些情况可以被承认为问题。'],
      ['形成条件', '职位能够赋予主体一定的形式权威，但非正式关系、专业能力和组织信用同样会影响三权的实际分布。'],
      ['失效方式', '当内部口径比实际情况更受重视时，汇报会逐步向口径靠拢，组织得到的是与口径高度一致的图景。']
    ] },
  { label: '制度', code: '层次 04 · 制度', title: '法律、教育、统计、档案与行政分类',
    rows: [
      ['三权表现', '为社会提供较为稳定的概念与解释框架。制度化定义不仅存在于语言之中，还会进入程序、资源分配和身份认证。'],
      ['形成条件', '制度化定义往往具有较强的持续性，因为它们的更换会牵动档案、资格和既得利益。'],
      ['失效方式', '制度也可能因为现实变化、执行差异和社会信任下降而失去原有解释力。']
    ] },
  { label: '数字平台', code: '层次 05 · 数字平台', title: '通过推荐、审核、标签、热度决定什么更容易被看见',
    rows: [
      ['三权表现', '平台未必直接生产内容，却能够决定什么更容易被看见。它既是传播渠道，也是认知秩序的参与者。'],
      ['形成条件', '推荐、审核、标签、热度和账号机制共同构成可见性分配能力，且这种能力不以主张的形式出现。'],
      ['失效方式', '平台对可见性的控制可能进一步影响定义和解释，使原本处于边缘的说法进入中心，也可能让某些说法在尚未得到回应之前便失去传播条件。']
    ] }
]},

/* ---------- 第 1 章 ---------- */
'four-steps': {
  mode: 'inspect',
  note: '定义不等于结论，却决定人们从哪里开始寻找结论。点击每一步，看它在做什么。',
  nodes: [
    { n: '命名', d: '从复杂对象中提取部分特征，再用一个名称把这些特征集中起来。名称让对象获得一个可以识别的形式，也让与之相连的经验和态度被同时调动。' },
    { n: '分类与划界', d: '决定对象应当与哪些对象放在一起，谁属于其中、谁被排除，并为边界两侧安排不同后果。边界不只是区分对象，还会分配资格和位置。' },
    { n: '标准', d: '把抽象概念转换为可以观察的指标，给指标赋予权重，最后形成通过、失败、优先或淘汰的判断。标准看似只是测量工具，实际上已经规定了什么值得被测量。' },
    { n: '跑道', d: '名称、分类和标准结合以后，问题应当怎样被提出就已经被安排了。支持者只需在跑道内继续讨论，反对者却必须先证明跑道本身存在问题——这种不对称，就是定义权。' }
  ]
},

naming: { items: [
  { label: '合作伙伴', code: '命名 A', title: '突出自主接单与合作关系',
    rows: [
      ['突显的特征', '自主接单、平等人格、合作关系。'],
      ['讨论的起点', '平台与接单者之间的关系被理解为<b>合作安排</b>，讨论会落在分成比例、算法规则和合约条件上。'],
      ['被推到背景的', '劳动管理、组织责任、保障与工时约束——它们不容易进入讨论，因为「合作」这个词本身不包含这些内容。']
    ] },
  { label: '员工', code: '命名 B', title: '突出劳动管理与组织责任',
    rows: [
      ['突显的特征', '受管理、有从属关系、承担组织交办的工作。'],
      ['讨论的起点', '劳动条件、组织责任和保障问题会立即进入讨论，责任的默认落点是<b>用工方</b>。'],
      ['被推到背景的', '平台作为技术中介的角色会被淡化——讨论转而追问「谁是用人单位」。']
    ] },
  { label: '用户', code: '命名 C', title: '把关系理解为服务提供者与使用者',
    rows: [
      ['突显的特征', '使用服务、获取订单、自主选择。'],
      ['讨论的起点', '平台与接单者的关系被理解为<b>服务与使用</b>，问题被归入产品体验和交易纠纷的范围。'],
      ['被推到背景的', '劳动关系的存在与否根本不会被提出——因为在这套分类里，它不是一个劳动关系。']
    ] },
  { label: '独立承包者', code: '命名 D', title: '突出自主选择与交易关系',
    rows: [
      ['突显的特征', '自愿缔约、自负盈亏、自担风险。'],
      ['讨论的起点', '自主选择和交易关系成为理解起点，讨论会落在<b>定价自由、竞争条件与合约公平</b>上。'],
      ['被推到背景的', '工作过程中的实际控制程度——即使规则由平台单方面设定，分类本身仍然把它读作自主选择。']
    ] }
]},

exception: {
  kind: 'ranges', acc: '--exp', min: 0, max: 12, value: 1,
  label: '例外数量',
  warmFrom: 3, hotFrom: 8,
  ticks: ['刚建立：例外很少', '例外开始需要单独说明', '分类已经需要被整理'],
  gauges: [
    { label: '分类的整理能力', get: function(v){ return Math.max(0, 100 - v * 8); }, bar: 'b' },
    { label: '维持分类的工作量', get: function(v){ return Math.min(100, v * 9); }, bar: 'a' }
  ],
  zones: [
    { max: 2, text: '阶段 · <b>个别情况</b>　每一条例外都能被单独说明。分类仍然在正常发挥整理现实的作用，例外只用来保护分类。' },
    { max: 5, text: '阶段 · <b>需要注意的几个方面</b>　例外开始成组出现，说明从「个别情况」升级为「需要注意的几个方面」。反例仍然被当作执行偏差，而不是分类本身的问题。' },
    { max: 9, text: '阶段 · <b>专门规则</b>　补充说明已经支撑不住，需要为一类对象订立专门规则。此时分类<b>不再起整理作用，反而需要被整理</b>。' },
    { max: 99, text: '阶段 · <b>定义危机</b>　例外过多，暴露了分类已经没有整理现实的能力。旧名称并未突然消失，它仍在使用，人们却越来越难依靠它理解新经验。<b>而放弃它又要处理全部既有记录——主体因此被卡在两难位置上。</b>', hot: true }
  ]
},

/* ---------- 第 2 章 ---------- */
causal: {
  kind: 'discrete', acc: '--exp', min: 0, max: 2, value: 0,
  label: '因果链起点',
  ticks: ['从操作人员违规讲起', '从检修计划被推迟讲起', '从设备老化和生产压力讲起'],
  steps: [
    { cards: [
        { k: '结论形状', v: '个人失误' },
        { k: '责任落点', v: '直接行动者 · 操作人员' }
      ],
      chain: { nodes: ['设备老化', '培训不足', '检修计划被推迟', '操作人员违规', '事故发生'], causeFrom: 3 },
      note: '因果链被压缩到离结果最近的行为，责任集中到最直接的行动者身上。<b>把起点放在按错按钮，组织就可以通过更换责任人来保存原有机制。</b>' },
    { cards: [
        { k: '结论形状', v: '管理责任' },
        { k: '责任落点', v: '管理决策层' }
      ],
      chain: { nodes: ['设备老化', '培训不足', '检修计划被推迟', '操作人员违规', '事故发生'], causeFrom: 2 },
      note: '起点前移到检修计划，管理决定进入核心。操作失误仍然存在，但它的位置<b>从原因变成了结果</b>——设备故障、培训不足与管理压力，决定了这次失误为什么会造成严重后果。' },
    { cards: [
        { k: '结论形状', v: '组织机制长期运行的结果' },
        { k: '责任落点', v: '制度与资源安排' }
      ],
      chain: { nodes: ['设备老化', '培训不足', '检修计划被推迟', '操作人员违规', '事故发生'], causeFrom: 0 },
      note: '原因越向外追溯，更多结构性条件被看见，责任范围随之扩大。<b>解释权的效果，取决于哪一层最终被社会认定为主要原因。</b>只强调个人，组织可以通过更换责任人来保存原有机制；只强调结构，具体行动者又可能借助宏大原因逃避自身责任。' }
  ]
},

'four-acts': {
  mode: 'inspect',
  note: '解释者没有凭空创造事实，却通过选择起点和连接方式改变了事实的意义。点击任一动作。',
  nodes: [
    { n: '选择', d: '决定什么材料值得进入说明。材料能否被获得，决定解释者最初能够看到什么；材料是否被认定为真实，决定它能否进入讨论。' },
    { n: '连接', d: '把不同事实连接起来，建立先后、因果和主次关系。同一个结果从个人行为讲起会形成一种责任结构，从组织条件讲起又会形成另一种。' },
    { n: '归因', d: '根据这些关系分配动机与责任。但一个因素参与了结果的形成，不代表相关主体必然承担同等责任——还要考虑是否知道风险、是否有能力改变结果、是否拥有相应权限。' },
    { n: '定型', d: '给整个事件确定一种可以被理解和记忆的意义。定型之后争议暂时结束，社会开始按照某个版本记录事件、分配责任并选择行动。' }
  ]
},

absorb: {
  color: '--exp',
  introTitle: '事件刚发生：事实零散，受众急于获得一个可以理解的版本',
  intro: '这个阶段存在「意义空缺」。点「推演」，看一次解释如何被建立，又如何吸收随后出现的每一份新材料。',
  steps: [
    { t: '意义空缺', color: '--ink-4', title: '事件刚发生：事实零散，没有人给出组织方式',
      text: '事故留下了伤亡、损失、影像和记录，但这些材料不会自己说明事故为什么发生，也不会自行决定谁应当负责。受众迫切需要一个可以理解的版本——<b>谁能率先把人物、原因、责任和结果连接起来，谁就取得第一解释的优势。</b>' },
    { t: '建立第一解释', color: '--exp', title: '一个结构完整的版本先进入认知',
      text: '企业宣布「员工违规操作」。<b>第一解释不一定最准确，却让后来者承担拆解旧框架的额外成本。</b>一个未经证实但结构完整的版本，往往比大量彼此分散的真实材料更早进入认知，因为前者已经回答了受众最迫切的问题。' },
    { t: '吸收新事实', color: '--exp', title: '后来出现的设备故障记录被安排进原框架',
      text: '设备故障记录出现了。它没有被否认，而是被<b>放进一个无法动摇整体判断的位置</b>：被看成背景问题，或者被解释为「与直接原因无关」。第一解释并没有消灭新事实，却提前规定了新事实在整个事件中的位置。' },
    { t: '吸收反向材料', color: '--danger', title: '管理层推迟检修的材料出现',
      text: '管理层推迟检修的材料出现了。它可能被读作「制度本来就允许的弹性安排」，或者「与操作人员的个人选择无关」。<b>强势解释不需要逐条击败反对意见，只需要为反对行为预先安排位置。</b>' },
    { t: '解释吸收完成', color: '--danger', title: '对象的每一种反应，都成为支持原版本的新材料',
      text: '操作人员出面说明设备故障——被读作推卸责任；他愤怒——被读作心虚；他沉默——被读作默认；他拒绝参与调查——被读作缺乏依据。<b>解释体系因此形成自我确认：拥有解释权的一方不仅说明过去发生了什么，还能够解释别人为什么不同意自己的说明。</b>这就是「被他人书写」——主体仍然是事件参与者，却不再拥有确定自身行为意义的资格。' }
  ]
},

/* ---------- 第 3 章 ---------- */
pipe: {
  mode: 'gate',
  note: '点击任一闸门切换「打开／受阻」。',
  allOpen: '<b>五道闸门全开</b>——声音进入渠道、抵达受众、获得采信并继续流动。这才是话语权：不是能不能说话，而是这条链条能运转到什么程度。',
  nodes: [
    { n: '发言资格' }, { n: '渠道入口' }, { n: '抵达' }, { n: '信任链' }, { n: '转发与留存' }
  ],
  stop: [
    '停在「<b>发言资格</b>」——声音连被承认为「值得进入讨论」的机会都没有。它不一定被禁止，也可能只是被安排在不重要的位置：同一句话会被当作专业意见、当事人陈述、普通评论，还是无关噪声。',
    '停在「<b>渠道入口</b>」——有资格说，却接不进任何一条能抵达受众的通道。渠道并不是一条中性的传送管道，接入也不只是「能够发布」，还包括发布在什么位置、能够停留多久、是否进入推荐。',
    '停在「<b>抵达</b>」——发布只是内容进入系统，抵达才是内容真正出现在受众的认知范围内。<b>名义受众不等于实际受众</b>：一份文件被发送到所有成员，不代表所有成员都会阅读。',
    '停在「<b>信任链</b>」——声音发得出、传得开，却不被当作可以用于判断的信息。此时沉默不再是可自主选择的策略，而只是没有声音。',
    '停在「<b>转发与留存</b>」——能抵达，但不能被重复、被保存、被引用，影响无法累积。话语权的丧失也可能发展为认知消除：缺少回应的版本逐渐固定，缺少记录的经验逐渐消失。'
  ]
},

frequency: {
  kind: 'ranges', acc: '--dis', min: 0, max: 100, value: 8,
  label: '曝光频次',
  warmFrom: 30, hotFrom: 62,
  ticks: ['几乎没人听说过', '熟悉', '疲劳与逆反'],
  gauges: [
    { label: '熟悉度 · 可调用性', get: function(v){ return Math.round(100 * (1 - Math.exp(-v / 26))); }, bar: 'b' },
    { label: '疲劳与抗拒', get: function(v){ return Math.min(100, Math.max(0, Math.round((v - 45) * 1.85))); }, bar: 'a' }
  ],
  zones: [
    { max: 14, text: '阶段 · <b>几乎没有留下印象</b>　频率过低，信息无法在认知中留下痕迹。此时提高频次是有效投入。' },
    { max: 45, text: '阶段 · <b>熟悉度上升</b>　重复曝光提高了信息的熟悉度和可调用性。受众不一定明确相信它，但在需要快速判断时更容易首先想起它。<b>重复的作用不在于把虚假变成真实，而在于让某个版本更容易被调用。</b>' },
    { max: 62, text: '阶段 · <b>接近转折点</b>　熟悉度基本饱和，而抗拒开始出现。转折点的位置与内容的复杂度、受众的投入程度和表达形式直接相关：<b>信息越简单、受众参与越低、形式越单一，转折来得越早。</b>' },
    { max: 99, text: '阶段 · <b>逆反</b>　受众不仅回避内容，而且开始把回避本身当作一种自我表达：不接受这种说法，是因为不接受被这样安排。此时传播强度越高，抗拒越强——<b>因为它证明了对受众时间的持续占用。</b>被消耗的不是某一句台词，而是接触这种说法的意愿本身。', hot: true }
  ]
},

audience: { items: [
  { label: '账号关注者众多', code: '情形 01', title: '名义规模很大',
    rows: [
      ['看起来的触达', '一个账号拥有大量关注者，看起来每次表达都能触达这些人。'],
      ['实际触达', '平台分发、打开率、活跃度共同决定它实际只触及其中一部分，而且往往是最不关键的一部分。'],
      ['差在哪里', '数字衡量的是<b>曾经建立的关系</b>，不是每次表达的实际到达。']
    ] },
  { label: '文件群发给全体成员', code: '情形 02', title: '形式上的全覆盖',
    rows: [
      ['看起来的触达', '一份文件被发送到所有成员，覆盖率 100%。'],
      ['实际触达', '不代表所有成员都会阅读，更不代表他们据此理解组织正在发生什么。'],
      ['差在哪里', '发送是<b>信息进入系统</b>，阅读与理解才是信息真正出现在认知范围内。']
    ] },
  { label: '一场公开讨论', code: '情形 03', title: '围观很多，决策者不在场',
    rows: [
      ['看起来的触达', '一场公开讨论可以吸引大量旁观者，声量很大。'],
      ['实际触达', '<b>未必影响真正拥有决策权的少数人</b>——他们可能既没有参与，也不需要回应。'],
      ['差在哪里', '真正有效的抵达，是让应当看见的人在能够理解和回应的情境中接触到信息，而非让所有人都看见。']
    ] },
  { label: '圈内热传', code: '情形 04', title: '规模不大，但都是目标人群',
    rows: [
      ['看起来的触达', '覆盖范围很小，传播量远低于前几种情形。'],
      ['实际触达', '触达的却恰好是能够做出反应的群体，且处在能够行动的位置上。'],
      ['差在哪里', '话语权的衡量标准不是覆盖面，而是<b>实际触达能否转化为后续反应</b>。大规模传播可能只是在同类人群中反复循环。']
    ] }
]},

/* ---------- 第 4 章 ---------- */
loop: {
  color: '--def',
  introTitle: '闭环尚未启动',
  intro: '三权的完整运行通常经历四个阶段，而每一轮闭环结束后，留下的名称、信用和渠道会成为下一轮竞争的初始资源。点「推演」逐阶段观看。',
  steps: [
    { t: '启动', color: '--def', title: '定义承担主要作用：复杂现象被提取、命名和分类',
      text: '原本分散的事实由此成为可以讨论的对象。这个阶段的核心争夺在于<b>对象能否以某种身份进入认知</b>，而不在怎样评价它。谁能决定讨论对象是什么，就已经安排了后续的举证责任。' },
    { t: '铺开', color: '--dis', title: '话语权承担主要作用：名称在频次、覆盖和信任链中获得可见性',
      text: '传播不仅扩大范围，也会<b>筛选定义</b>。难以理解、无法转述或不能连接受众经验的概念容易消失，能够被快速识别和调用的概念则更容易进入公共语言。' },
    { t: '落地', color: '--exp', title: '解释完成意义收束：分散事实被组织为因果与责任',
      text: '事件被放入更大的价值和历史结构。传播留下的模糊印象在这一阶段转化为相对稳定的主要版本，并进一步进入制度结论、群体记忆和日常判断。' },
    { t: '反哺', color: '--def', title: '已经形成的结果重新影响三权本身',
      text: '成功解释会证明原定义「准确」，提高定义者的资格；得到广泛接受的版本会增强解释者的公信力，使其在下一次事件中更容易获得注意；渠道也会因为曾经成功组织受众而扩大自身影响。<b>上一轮形成的名称、信用和网络，成为下一轮竞争的初始资源。</b>' }
  ]
},

triad: {
  init: 'def',
  dims: [
    { k: 'def', name: '定义权', led: '01', q: '命名 · 分类 · 划界 · 标准', color: '--def' },
    { k: 'exp', name: '解释权', led: '02', q: '因果 · 责任 · 意义 · 定型', color: '--exp' },
    { k: 'dis', name: '话语权', led: '03', q: '资格 · 渠道 · 抵达 · 信任', color: '--dis' }
  ],
  states: {
    '100': { tag: '单权状态', color: '--def', title: '仅掌握定义权',
      can: '创造名称、建立分类、划定边界',
      stuck: '无法保证概念被广泛使用，也无法决定概念最终获得什么意义',
      state: '有概念，却没有扩散和定论',
      foot: '新概念可能在专业领域十分准确，却因为没有传播渠道而无人知晓；也可能得到有限传播，却被其他解释者赋予完全不同的含义。<b>掌握一权的主体通常会主动寻找第二项能力：定义者寻找渠道。</b>' },
    '010': { tag: '单权状态', color: '--exp', title: '仅掌握解释权',
      can: '组织因果、分配责任、对事件作出裁决',
      stuck: '未必能够决定讨论对象如何命名，也没有能力保证自己的版本抵达受众',
      state: '有裁决，却没有起点和渠道',
      foot: '如果定义权掌握在其他主体手中，解释者可能始终在别人设定的概念中作答。解释权在组织、司法和专业领域中可以依靠程序形成强制效果，但一旦离开这些场域，它仍然需要定义和传播提供支撑。' },
    '001': { tag: '单权状态', color: '--dis', title: '仅掌握话语权',
      can: '拥有渠道、频次和覆盖范围，可以制造巨大可见性',
      stuck: '没有能力生产自己的概念，也无法让传播内容形成稳定意义',
      state: '有渠道，却没有自己的概念和结局',
      foot: '它可以反复讨论某个对象，却始终使用别人提供的名称；可以扩大某种情绪，却不能说明情绪应当指向什么原因和责任。<b>话语权能够制造注意，却不能自动把注意转化为认知秩序。</b>' },
    '110': { tag: '两权主导', color: '--def', title: '定义权 ＋ 解释权',
      can: '同时控制认知起点与意义终点：先决定对象是什么，再依据同一套分类和标准组织因果与责任',
      stuck: '缺少外部扩散——如果话语渠道掌握在竞争者手中，正式定义与解释可能在制度内部有效，在公共认知中却处于弱势',
      state: '意义封闭',
      foot: '定义为解释规定对象，解释又反过来证明定义正确，二者容易形成意义上的封闭结构。这种组合在法律、行政、专业组织和封闭群体中尤其有效，因为场域本身可以把定义和解释直接写入记录和程序。' },
    '101': { tag: '两权主导', color: '--dis', title: '定义权 ＋ 话语权',
      can: '议题占位：制造概念，也能通过渠道和频次把概念铺成默认认识',
      stuck: '缺乏解释收束能力——概念可以得到普及，意义却可能被对手重新占据',
      state: '议题占位',
      foot: '受众可能尚未接受某种解释，却已经习惯用掌握者提供的名称讨论问题。反对者即使提出不同结论，也必须先处理这个名称及其边界。<b>这种组合特别适合认知竞争的启动与扩张阶段。</b>' },
    '011': { tag: '两权主导', color: '--exp', title: '解释权 ＋ 话语权',
      can: '把一套完整意义持续送入受众，在事件发生后迅速形成主要版本',
      stuck: '解释可能仍然被困在别人建立的概念中——如果对象的名称、分类和边界由对手决定，掌握者就可能始终在回答对方提出的问题',
      state: '快速定型',
      foot: '这种组合在舆论竞争、危机定性和社会动员中具有明显优势。它也有一条长期的侵蚀路径：当一种解释持续改变旧概念的使用方式，原有名称可能被重新赋义，最终迫使社会接受新的分类。' },
    '111': { tag: '闭环控制', color: '--ink-2', title: '三权齐备',
      can: '决定对象是什么、说明它意味着什么，并把这套认识持续送入受众',
      stuck: '协调成本高，且三项功能共用同一份信用储备——定义被证伪，此前基于该定义的传播内容全部需要重新评估',
      state: '最强，也最脆弱',
      foot: '闭环控制不等于对所有人的思想进行绝对控制。集中带来单点失效：三权分散时，一个环节出问题，另外两个仍可支撑局面；三权集中时，问题的暴露路径同时也是整个结构的暴露路径。<b>这也是集中结构往往在长期表现更好、在一次冲击后表现更差的原因。</b>' },
    '000': { tag: '三权尽失', color: '--danger', title: '认知消灭',
      can: '仍然可以在物理意义上存在，也可以继续行动和发言',
      stuck: '无法决定自己以什么身份出现，无法组织自身经历的因果与意义，也无法把自己的版本送到目标受众面前',
      state: '从行动者变成被说明的对象',
      foot: '所谓认知消灭并不是物理消灭，也不只是暂时无人关注——它指的是一个主体逐渐失去以自己的名称、意义和声音存在于共同认知中的能力。这种状态具有范围：一个群体可以在公共空间中失去三权，却在内部关系和私人记录中保存自身定义。<b>重新进入认知秩序，往往需要先夺回一个立足点，再取得第二项能力或与其他主体形成稳定联盟。</b>' }
  }
},

combos: {
  cols: ['定义 ＋ 话语', '定义 ＋ 解释', '话语 ＋ 解释'],
  rows: ['最强能力', '优势场景', '主要弱点'],
  cells: [
    [
      '议题占位：制造概念，并通过渠道和频次把它铺成默认认识。受众可能尚未接受某种解释，却已经习惯用这个名称讨论问题。',
      '同时控制认知起点与意义终点，容易形成意义上的封闭结构。定义为解释规定对象，解释又反过来证明定义正确。',
      '把一套完整意义持续送入受众，事件发生后迅速形成主要版本。'
    ],
    [
      '认知竞争的启动与扩张阶段。<b>反对者必须先处理这个名称及其边界。</b>',
      '法律、行政、专业组织和封闭群体——场域本身可以把定义和解释直接写入记录和程序。',
      '舆论竞争、危机定性与社会动员。'
    ],
    [
      '缺乏解释收束能力；概念可以普及，意义却可能被对手重新占据。',
      '缺少外部扩散；正式定义与解释可能在制度内部有效，在公共认知中却处于弱势。',
      '解释可能仍然被困在别人建立的概念中——如果对象的名称、分类和边界由对手决定，掌握者就可能始终在回答对方提出的问题。'
    ]
  ],
  note: '三种组合没有绝对固定的强弱顺序。哪一种更强，取决于竞争发生在什么阶段、什么场域，以及缺失的第三权掌握在谁手中。<b>两权主导的实质是两项能力能够真正接入同一回路，而不只是同时拥有两项资源。</b>'
},

closure: {
  order: ['不理性', '别有用心', '不够专业', '自我炒作'],
  sets: {
    '不理性': {
      rows: [
        ['激烈回应', '被读作：<em>果然不理性</em>'],
        ['平静回应', '被读作：<em>伪装，或刻意克制</em>'],
        ['拒绝回应', '被读作：<em>无话可说，即默认</em>'],
        ['自己收集证据', '被读作：<em>情绪化的自我辩护</em>']
      ],
      note: '定义闭合的运作方式：先为对象确定性质，再根据这一性质解释对象的一切表现，最后用经过解释的表现反过来证明最初定义。<b>对象越试图摆脱分类，越可能被认为符合分类预期。</b>'
    },
    '别有用心': {
      rows: [
        ['说明理由', '被读作：<em>早有准备的辩解</em>'],
        ['拒绝解释', '被读作：<em>默认动机不纯</em>'],
        ['出示证据', '被读作：<em>选择性出示，反证在经营形象</em>'],
        ['要求对方举证', '被读作：<em>转移话题</em>']
      ],
      note: '标签一旦被接受，受众便倾向于从标签出发理解对象的后续行为。标签并没有自动垄断解释权，<b>却会明显压缩其他解释的进入空间</b>。'
    },
    '不够专业': {
      rows: [
        ['引用数据', '被读作：<em>术语堆砌，回避要害</em>'],
        ['承认不确定', '被读作：<em>果然没有能力下判断</em>'],
        ['请第三方背书', '被读作：<em>拉关系，不是自身判断</em>'],
        ['从亲身经验出发', '被读作：<em>个案不能代表一般情况</em>']
      ],
      note: '复杂化门槛是标准控制的另一种形式——当复杂程度超过问题本身需要，并且只对外部参与者提出时，<b>知识门槛便会转化为资格门槛</b>。当事经验无法转换成专业格式，也难以进入正式讨论。'
    },
    '自我炒作': {
      rows: [
        ['保持低调', '被读作：<em>欲擒故纵</em>'],
        ['正面回应', '被读作：<em>借机扩大声量</em>'],
        ['不再提及', '被读作：<em>热度过去，无可辩驳</em>'],
        ['停止更新', '被读作：<em>目的已达到，收工</em>']
      ],
      note: '标签真正锁定的不是对象本身，<b>而是受众以后处理对象信息的默认方向</b>。它降低识别成本，也压缩个体差异和改变可能。'
    }
  }
}

};

/* ============================================================
   挂载全部交互块
   ============================================================ */
function mountAll(){
  var blocks = document.querySelectorAll('.ix');
  for (var i = 0; i < blocks.length; i++){
    var fig = blocks[i];
    var type = fig.getAttribute('data-ix');
    var id = fig.getAttribute('data-id');
    var body = fig.querySelector('.ix-body');
    var spec = SPECS[id];
    if (!body || !spec) continue;
    try{
      if (type === 'chain') renderChain(spec, body);
      else if (type === 'stepper') renderStepper(spec, body);
      else if (type === 'slider') renderSlider(spec, body);
      else if (type === 'picker') renderPicker(spec, body);
      else if (type === 'matrix') renderMatrix(spec, body);
      else if (type === 'sim') renderSim(spec, body);
      else if (type === 'closure') renderClosure(spec, body);
    }catch(err){
      body.innerHTML = '<div class="ix-note">组件渲染失败：' + (err && err.message ? err.message : err) + '</div>';
    }
  }
}

/* ============================================================
   图 01 · 三权与认知链（canvas 手绘，跟随主题）
   ============================================================ */
var atlas = document.getElementById('atlas');
var actx = atlas ? atlas.getContext('2d') : null;
var PAL = null;

function parseColor(c){
  c = String(c || '').trim();
  if (c.charAt(0) === '#'){
    var h = c.slice(1);
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  var m = c.match(/rgba?\(([^)]+)\)/);
  if (m){
    var p = m[1].split(',').map(function(x){ return parseFloat(x); });
    return [p[0] || 0, p[1] || 0, p[2] || 0];
  }
  return [128, 128, 128];
}
function rgba(c, a){
  var p = parseColor(c);
  return 'rgba(' + p[0] + ',' + p[1] + ',' + p[2] + ',' + a + ')';
}
function readPal(){
  var cs = getComputedStyle(document.documentElement);
  var g = function(n){ return cs.getPropertyValue(n).trim(); };
  return {
    bg: g('--bg-2'), grid: g('--grid'), line: g('--line'), lineHi: g('--line-hi'),
    ink: g('--ink'), ink2: g('--ink-2'), ink3: g('--ink-3'), ink4: g('--ink-4'),
    center: g('--ink-3'), nodeInk: g('--node-ink'), surface: g('--surface'),
    def: g('--def'), exp: g('--exp'), dis: g('--dis')
  };
}

var centerNode = { x: 480, y: 300, r: 46, label: '社会认知秩序',
  desc: '社会在特定时期内形成的认知排列：哪些对象能被看见，哪些名称可以被公开使用，哪些解释更容易获得信任。' };

var DIMS = [
  { id: 'def', label: '定义权', x: 220, y: 205, r: 38, base: 2.79, arc: 1.5, dist: 148, col: 'def',
    desc: '使某种命名、分类、边界或判断标准，成为他人认识对象时优先依据的能力。',
    subs: [
      { label: '命名', desc: '从复杂对象中提取部分特征，再用一个名称把这些特征集中起来，把复杂现实转化为可识别的对象。' },
      { label: '分类划界', desc: '决定对象应当与哪些对象放在一起、谁属于其中、谁被排除，并为边界两侧安排不同后果。' },
      { label: '标准跑道', desc: '抽象概念被转换为可观察的指标，指标被赋予权重，判断便沿着预设方向运行。标准规定了什么值得被测量。' },
      { label: '认知压缩', desc: '被选中的特征成为对象的代表，其余事实被视为次要内容或无关信息。定义权的影响在于安排注意力，并把认知成本分配给各方。' },
      { label: '定义闭合', desc: '先为对象确定性质，再根据这一性质解释它的一切表现，最后用表现反过来证明最初定义。对象越试图摆脱，越被认为符合预期。' },
      { label: '概念重置', desc: '当现实中出现无法被原定义容纳的对象时，需要重新提取特征、建立分类、划出可执行边界，并提供能进入判断的标准。' }
    ],
    rels: [[0,1,'归属'],[1,2,'约束'],[4,5,'破裂']] },

  { id: 'dis', label: '话语权', x: 740, y: 205, r: 38, base: -0.35, arc: 1.5, dist: 148, col: 'dis',
    desc: '使自己的定义、解释和主张抵达特定受众，并获得注意、采信和继续传播的能力。',
    subs: [
      { label: '发言资格', desc: '决定谁可以在什么场合说话，也决定同一句话会被当作专业意见、当事人陈述、普通评论还是无关噪声。' },
      { label: '渠道入口', desc: '接入渠道不只是能够发布，还包括发布在什么位置、能够停留多久、是否进入推荐、能否抵达关键节点。' },
      { label: '抵达频次', desc: '发布只是内容进入系统，抵达才是内容真正出现在受众的认知范围内。音量不等于话语权。' },
      { label: '信任链', desc: '受众无法核查每一项数据，只能借助来源信誉降低判断成本。转发把自己的信用附加到内容上，同时也改写内容。' },
      { label: '跨群体编码', desc: '越过圈层需要把圈内语言转换为圈外可理解的概念，并依靠桥接节点。覆盖扩大可能同时削弱原本的诉求。' },
      { label: '话语排除', desc: '最深的排除是让某些人的话天然不被算作证据。它不表现为公开禁止，而表现为一连串看似独立的筛选。' }
    ],
    rels: [[0,1,'门槛'],[1,2,'管道'],[3,4,'桥接']] },

  { id: 'exp', label: '解释权', x: 480, y: 510, r: 38, base: 1.571, arc: 1.5, dist: 148, col: 'exp',
    desc: '使自己的因果组织、责任判断和意义说明，成为他人理解事实时优先依据的能力。',
    subs: [
      { label: '选择连接', desc: '决定什么材料值得进入说明，再把不同事实连接起来，建立先后、因果和主次关系。' },
      { label: '因果起点', desc: '因果链从哪里开始，决定哪些内容被看作原因，哪些只能成为结果；也决定哪些主体进入责任范围。' },
      { label: '责任分配', desc: '一个因素参与结果的形成，不代表相关主体必然承担同等责任。还要考虑是否知道风险、是否有能力改变、是否获益。' },
      { label: '证据资格', desc: '材料能否在某套解释秩序中产生证明作用，与它客观上是否存在无关。解释权通过规定事实必须以什么形式出现来控制入口。' },
      { label: '第一解释', desc: '最早完成有效组织的一方为后续信息建立框架。它不一定最准确，却让后来者承担拆解旧框架的额外成本。' },
      { label: '解释吸收', desc: '强势解释为反对行为预先安排位置：辩解成为掩饰，反击成为失控，拒绝参与成为缺乏依据。' }
    ],
    rels: [[0,1,'排序'],[1,2,'归因'],[4,5,'固化']] }
];

var RELAY = [
  { from: 'def', to: 'dis', ctrl: [480, 150], label: '① 铺开', lx: 480, ly: 156 },
  { from: 'dis', to: 'exp', ctrl: [651, 375], label: '② 收束', lx: 678, ly: 388 },
  { from: 'exp', to: 'def', ctrl: [309, 376], label: '③ 反哺', lx: 282, ly: 388 }
];

var atlasPhase = 0, expandedDim = null, animP = 1, animDir = 0, animRaf = null;
var hovered = null, popup = null, entranceTimer = null;

function dimById(id){
  for (var i = 0; i < DIMS.length; i++) if (DIMS[i].id === id) return DIMS[i];
  return null;
}
function dimColor(d){ return PAL[d.col]; }
function subPos(dim, idx, p){
  var n = dim.subs.length;
  var a = dim.base - dim.arc / 2 + (n > 1 ? (idx / (n - 1)) * dim.arc : 0);
  var d = dim.dist * p;
  return { x: dim.x + Math.cos(a) * d, y: dim.y + Math.sin(a) * d, a: a };
}
function rr(ctx, x, y, w, h, r){
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
function glow(ctx, x, y, r, color, alpha){
  var g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, alpha));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}
function qPoint(p0, c, p1, t){
  var mt = 1 - t;
  return { x: mt*mt*p0.x + 2*mt*t*c.x + t*t*p1.x, y: mt*mt*p0.y + 2*mt*t*c.y + t*t*p1.y };
}
function plate(ctx, x, y, text, color, align){
  ctx.save();
  ctx.font = '13px -apple-system,"PingFang SC","Noto Sans SC",sans-serif';
  var w = ctx.measureText(text).width + 22, h = 28;
  var lx = (align === 'center') ? x - w / 2 : x;
  if (lx < 6) lx = 6;
  if (lx + w > atlas.width - 6) lx = atlas.width - 6 - w;
  ctx.fillStyle = rgba(PAL.surface, 0.94);
  ctx.strokeStyle = rgba(PAL.lineHi, 0.6);
  ctx.lineWidth = 1;
  rr(ctx, lx, y - h / 2, w, h, 6);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = color;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, lx + w / 2, y);
  ctx.restore();
}
function node(ctx, x, y, r, color, label, isHover){
  if (isHover) glow(ctx, x, y, r + 20, color, 0.3);
  ctx.save();
  ctx.shadowColor = isHover ? rgba(color, 0.55) : rgba(PAL.ink4, 0.45);
  ctx.shadowBlur = isHover ? 26 : 12;
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.fillStyle = PAL.nodeInk;
  ctx.font = 'bold 14px -apple-system,"PingFang SC","Noto Sans SC",sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y + 1);
  ctx.restore();
}
function subNode(ctx, x, y, color, label, isHover, above){
  if (isHover) glow(ctx, x, y, 22, color, 0.34);
  ctx.save();
  ctx.shadowColor = rgba(color, isHover ? 0.8 : 0.35);
  ctx.shadowBlur = isHover ? 18 : 8;
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, isHover ? 9 : 7, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  plate(ctx, x, y + (above ? -30 : 30), label, isHover ? color : PAL.ink2, 'center');
}

function drawAtlas(){
  if (!actx || !atlas) return;
  PAL = readPal();
  var ctx = actx, W = atlas.width, H = atlas.height;

  ctx.fillStyle = PAL.bg;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.strokeStyle = PAL.grid;
  ctx.lineWidth = 1;
  for (var gx = 60; gx < W; gx += 60){ ctx.beginPath(); ctx.moveTo(gx + .5, 0); ctx.lineTo(gx + .5, H); ctx.stroke(); }
  for (var gy = 60; gy < H; gy += 60){ ctx.beginPath(); ctx.moveTo(0, gy + .5); ctx.lineTo(W, gy + .5); ctx.stroke(); }
  ctx.restore();

  var ep = Math.max(0, Math.min(1, atlasPhase));
  var cAlpha = Math.min(1, ep / 0.3);
  var lAlpha = Math.min(1, Math.max(0, ep - 0.12) / 0.3);

  ctx.save();
  ctx.globalAlpha = lAlpha;
  ctx.strokeStyle = PAL.line;
  ctx.lineWidth = 1;
  for (var i = 0; i < DIMS.length; i++){
    ctx.beginPath(); ctx.moveTo(centerNode.x, centerNode.y); ctx.lineTo(DIMS[i].x, DIMS[i].y); ctx.stroke();
  }
  ctx.restore();

  /* 接力弧线 */
  ctx.save();
  ctx.globalAlpha = lAlpha;
  for (var r = 0; r < RELAY.length; r++){
    var rl = RELAY[r], p0 = dimById(rl.from), p1 = dimById(rl.to);
    var c = { x: rl.ctrl[0], y: rl.ctrl[1] };
    ctx.strokeStyle = rgba(PAL.lineHi, 0.9);
    ctx.lineWidth = 1.4;
    ctx.setLineDash([7, 6]);
    ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.quadraticCurveTo(c.x, c.y, p1.x, p1.y); ctx.stroke();
    ctx.setLineDash([]);
    var mid = qPoint(p0, c, p1, 0.5);
    var dx = p1.x - p0.x, dy = p1.y - p0.y, len = Math.sqrt(dx*dx + dy*dy) || 1;
    var ux = dx / len, uy = dy / len;
    ctx.fillStyle = rgba(PAL.ink2, 0.8);
    ctx.beginPath();
    ctx.moveTo(mid.x + ux*7 - uy*4.6, mid.y + uy*7 + ux*4.6);
    ctx.lineTo(mid.x - ux*4, mid.y - uy*4);
    ctx.lineTo(mid.x + ux*7 + uy*4.6, mid.y + uy*7 - ux*4.6);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = PAL.ink3;
    ctx.font = '11px ui-monospace,Consolas,monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(rl.label, rl.lx, rl.ly);
  }
  ctx.restore();

  var anyExpanded = expandedDim !== null && animP > 0.1;
  for (var d = 0; d < DIMS.length; d++){
    var dim = DIMS[d];
    var act = (dim.id === expandedDim);
    var alpha = (anyExpanded && !act ? 0.3 : 1) * lAlpha;
    var isH = hovered && hovered.type === 'dim' && hovered.ref === dim;
    ctx.save();
    ctx.globalAlpha = alpha;
    node(ctx, dim.x, dim.y, dim.r, dimColor(dim), dim.label, isH);
    ctx.restore();
  }

  var activeDim = expandedDim ? dimById(expandedDim) : null;
  if (activeDim && animP > 0){
    var above = activeDim.y > 330;
    var dc = dimColor(activeDim);
    for (var s = 0; s < activeDim.subs.length; s++){
      var pos = subPos(activeDim, s, animP);
      ctx.save();
      ctx.globalAlpha = Math.min(1, animP * 1.6);
      ctx.strokeStyle = rgba(dc, 0.3);
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 5]);
      ctx.beginPath(); ctx.moveTo(activeDim.x, activeDim.y); ctx.lineTo(pos.x, pos.y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
    if (activeDim.rels && animP > 0.35){
      var rp = (animP - 0.35) / 0.65;
      for (var q = 0; q < activeDim.rels.length; q++){
        var rel = activeDim.rels[q];
        var pa = subPos(activeDim, rel[0], animP), pb = subPos(activeDim, rel[1], animP);
        ctx.save();
        ctx.globalAlpha = 0.45 * rp;
        ctx.strokeStyle = rgba(dc, 0.9);
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
        ctx.globalAlpha = 0.85 * rp;
        ctx.fillStyle = PAL.ink3;
        ctx.font = '10.5px ui-monospace,Consolas,monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(rel[2], (pa.x + pb.x) / 2, (pa.y + pb.y) / 2 - 11);
        ctx.restore();
      }
    }
    for (var t = 0; t < activeDim.subs.length; t++){
      var sp = subPos(activeDim, t, animP);
      var sub = activeDim.subs[t];
      var isSH = hovered && hovered.type === 'sub' && hovered.ref === sub;
      ctx.save();
      ctx.globalAlpha = Math.min(1, animP * 2);
      subNode(ctx, sp.x, sp.y, dc, sub.label, isSH, above);
      ctx.restore();
    }
  }

  ctx.save();
  ctx.globalAlpha = cAlpha;
  ctx.translate(centerNode.x, centerNode.y);
  var cs = Math.min(1, ep / 0.35) * 0.25 + 0.75;
  ctx.scale(cs, cs);
  ctx.translate(-centerNode.x, -centerNode.y);
  node(ctx, centerNode.x, centerNode.y, centerNode.r, PAL.center, centerNode.label,
       hovered && hovered.type === 'center');
  ctx.restore();

  if (hovered){
    var text = hovered.type === 'center' ? centerNode.desc : hovered.ref.desc;
    if (text){
      ctx.save();
      ctx.font = '12.5px -apple-system,"PingFang SC","Noto Sans SC",sans-serif';
      var tw = ctx.measureText(text).width + 22, th = 32;
      var tx = Math.max(10, Math.min(W - tw - 10, hovered.x - tw / 2));
      var ty = hovered.y - 56;
      if (ty < 10) ty = hovered.y + 52;
      ctx.shadowColor = rgba('#000000', 0.4);
      ctx.shadowBlur = 16;
      ctx.fillStyle = rgba(PAL.surface, 0.97);
      ctx.strokeStyle = PAL.lineHi;
      ctx.lineWidth = 1;
      rr(ctx, tx, ty, tw, th, 6); ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = PAL.ink2;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(text, tx + tw / 2, ty + th / 2);
      ctx.restore();
    }
  }

  if (popup){
    var pd = popup.dim, ps = popup.sub, pc = dimColor(pd);
    ctx.save();
    ctx.font = 'bold 15px -apple-system,"PingFang SC","Noto Sans SC",sans-serif';
    var titleW = ctx.measureText(ps.label).width;
    ctx.font = '13px -apple-system,"PingFang SC","Noto Sans SC",sans-serif';
    var maxW = 330, lines = [], rest = ps.desc;
    while (rest.length > 0){
      var cut = rest.length;
      for (var ci = rest.length; ci > 0; ci--){
        if (ctx.measureText(rest.slice(0, ci)).width <= maxW || ci === 1){ cut = ci; break; }
      }
      lines.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
    var cardW = Math.max(titleW + 70, 350);
    var lineH = 23, cardH = 62 + lines.length * lineH + 34;
    var cx = Math.max(12, Math.min(W - cardW - 12, popup.x - cardW / 2));
    var cy = popup.y - cardH - 34;
    if (cy < 12) cy = popup.y + 40;
    if (cy + cardH > H - 12) cy = H - 12 - cardH;

    ctx.shadowColor = rgba('#000000', 0.5);
    ctx.shadowBlur = 28;
    ctx.fillStyle = rgba(PAL.surface, 0.99);
    ctx.strokeStyle = pc;
    ctx.lineWidth = 1;
    rr(ctx, cx, cy, cardW, cardH, 8); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = pc;
    rr(ctx, cx, cy, cardW, 3, 8); ctx.fill();
    ctx.fillRect(cx, cy + 1, cardW, 2);

    ctx.fillStyle = PAL.ink;
    ctx.font = 'bold 15px -apple-system,"PingFang SC","Noto Sans SC",sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(ps.label, cx + 20, cy + 30);
    ctx.fillStyle = pc;
    ctx.font = '10.5px ui-monospace,Consolas,monospace';
    ctx.textAlign = 'right';
    ctx.fillText(pd.label, cx + cardW - 20, cy + 30);
    ctx.fillStyle = PAL.ink2;
    ctx.font = '12.8px -apple-system,"PingFang SC","Noto Sans SC",sans-serif';
    ctx.textAlign = 'left';
    for (var li = 0; li < lines.length; li++) ctx.fillText(lines[li], cx + 20, cy + 62 + li * lineH);
    ctx.fillStyle = PAL.ink4;
    ctx.font = '10.5px ui-monospace,Consolas,monospace';
    ctx.textAlign = 'center';
    ctx.fillText('点击任意位置关闭', cx + cardW / 2, cy + cardH - 16);
    ctx.restore();
  }
}

function startExpand(id){
  if (expandedDim === id){ animDir = -1; expandedDim = null; }
  else { expandedDim = id; animDir = 1; animP = 0; }
  popup = null;
  if (animRaf) cancelAnimationFrame(animRaf);
  stepAnim();
}
function stepAnim(){
  var st = 0.075;
  if (animDir > 0){
    animP = Math.min(1, animP + st);
    drawAtlas();
    if (animP < 1) animRaf = requestAnimationFrame(stepAnim); else { animDir = 0; animRaf = null; }
  } else if (animDir < 0){
    animP = Math.max(0, animP - st * 1.3);
    drawAtlas();
    if (animP > 0) animRaf = requestAnimationFrame(stepAnim); else { animDir = 0; animRaf = null; }
  }
}
function canvasPos(e){
  var rect = atlas.getBoundingClientRect();
  var sx = atlas.width / rect.width, sy = atlas.height / rect.height;
  var c = (e.touches && e.touches[0]) ? e.touches[0] : e;
  return { x: (c.clientX - rect.left) * sx, y: (c.clientY - rect.top) * sy };
}
function hitDim(mx, my){
  for (var i = 0; i < DIMS.length; i++){
    var d = DIMS[i], dx = mx - d.x, dy = my - d.y;
    if (dx*dx + dy*dy <= (d.r + 8) * (d.r + 8)) return d;
  }
  var cx = mx - centerNode.x, cy = my - centerNode.y;
  if (cx*cx + cy*cy <= (centerNode.r + 8) * (centerNode.r + 8)) return centerNode;
  return null;
}
function hitSub(mx, my, dim, p){
  if (!dim || p < 0.35) return null;
  for (var i = 0; i < dim.subs.length; i++){
    var pos = subPos(dim, i, p), dx = mx - pos.x, dy = my - pos.y;
    if (dx*dx + dy*dy <= 22 * 22) return dim.subs[i];
  }
  return null;
}
function initAtlas(){
  if (!atlas) return;
  atlas.addEventListener('mousemove', function(e){
    var m = canvasPos(e), found = null;
    if (expandedDim && animP > 0.6){
      var d0 = dimById(expandedDim);
      var sb = hitSub(m.x, m.y, d0, animP);
      if (sb){
        var pp = subPos(d0, d0.subs.indexOf(sb), animP);
        found = { type: 'sub', ref: sb, x: pp.x, y: pp.y };
      }
    }
    if (!found){
      var hit = hitDim(m.x, m.y);
      if (hit) found = (hit === centerNode)
        ? { type: 'center', ref: hit, x: hit.x, y: hit.y }
        : { type: 'dim', ref: hit, x: hit.x, y: hit.y };
    }
    var changed = (found && !hovered) || (!found && hovered) || (found && hovered && found.ref !== hovered.ref);
    if (changed){ hovered = found; atlas.style.cursor = found ? 'pointer' : 'default'; drawAtlas(); }
  });
  atlas.addEventListener('mouseleave', function(){ if (hovered){ hovered = null; drawAtlas(); } });

  function tap(e){
    var m = canvasPos(e);
    if (popup){ popup = null; drawAtlas(); return; }
    if (expandedDim && animP > 0.8){
      var d0 = dimById(expandedDim);
      var sb = hitSub(m.x, m.y, d0, animP);
      if (sb){
        var pp = subPos(d0, d0.subs.indexOf(sb), animP);
        popup = { sub: sb, dim: d0, x: pp.x, y: pp.y };
        drawAtlas();
        return;
      }
    }
    var hit = hitDim(m.x, m.y);
    if (!hit || hit === centerNode){
      if (expandedDim){
        animDir = -1; expandedDim = null;
        if (animRaf) cancelAnimationFrame(animRaf);
        stepAnim();
      }
      return;
    }
    startExpand(hit.id);
  }
  atlas.addEventListener('click', tap);
  atlas.addEventListener('touchstart', function(e){ e.preventDefault(); tap(e); }, { passive: false });

  drawAtlas();
  setTimeout(function(){
    if (!entranceTimer) entranceTimer = setInterval(function(){
      atlasPhase = Math.min(1, atlasPhase + 0.035);
      drawAtlas();
      if (atlasPhase >= 1){ clearInterval(entranceTimer); entranceTimer = null; }
    }, 28);
  }, 400);

  var rt;
  window.addEventListener('resize', function(){
    clearTimeout(rt);
    rt = setTimeout(drawAtlas, 160);
  });
}

/* ---------------- 启动 ---------------- */
(function init(){
  initTheme();
  mountAll();
  initNav();
  initDrawer();
  initReveal();
  initAtlas();
})();
