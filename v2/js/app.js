/*
 * app.js —— 把「数据结构 / 渲染器 / 播放器」接到界面上。
 */
(function () {
  'use strict';

  const $ = (selector) => document.querySelector(selector);

  const SEED_VALUES = [50, 30, 70, 20, 40, 60, 80];
  const SPEEDS = [1200, 1000, 850, 750, 650, 550, 450, 350, 280, 220];

  const OP_META = {
    insert: { label: '插入', title: '伪代码 · 插入（回溯 + 旋转）' },
    delete: { label: '删除', title: '伪代码 · 删除（后继替换 + 回溯）' },
    search: { label: '查找', title: '伪代码 · 查找' },
  };

  const tree = new AVL.AVLTree({ values: SEED_VALUES });
  const renderer = new TreeRenderer($('#tree-svg'));

  const els = {
    insertForm: $('#insert-form'),
    insertInput: $('#insert-input'),
    removeForm: $('#remove-form'),
    removeInput: $('#remove-input'),
    searchForm: $('#search-form'),
    searchInput: $('#search-input'),
    modeInputs: Array.prototype.slice.call(document.querySelectorAll('input[name="tree-mode"]')),
    modeHint: $('#mode-hint'),
    speedInput: $('#speed-input'),
    speedLabel: $('#speed-label'),
    bfToggle: $('#bf-toggle'),
    btnRandom: $('#btn-random'),
    btnReset: $('#btn-reset'),
    btnClear: $('#btn-clear'),
    btnPlay: $('#btn-play'),
    btnPrev: $('#btn-prev'),
    btnNext: $('#btn-next'),
    btnFinish: $('#btn-finish'),
    stage: $('#stage'),
    statSize: $('#stat-size'),
    statHeight: $('#stat-height'),
    statBalanced: $('#stat-balanced'),
    statusMessage: $('#status-message'),
    progressFill: $('#progress-fill'),
    progressText: $('#progress-text'),
    opBadge: $('#op-badge'),
    codeTitle: $('#code-title'),
    codeList: $('#code-list'),
    logList: $('#log-list'),
  };

  const state = {
    result: null,
    runId: 0,
    loggedRunId: -1,
  };

  // ---------------------------------------------------------------------------
  // 播放器
  // ---------------------------------------------------------------------------
  const player = new StepPlayer({
    onStep: handleStep,
    onDone: handleDone,
    onStateChange: syncPlaybackUI,
  });

  function handleStep(step, index, total) {
    const duration = Math.min(currentDuration(), 520);
    renderer.render(step.tree, step, duration);
    highlightCodeLine(step.line);
    setStatus(step.message);
    updateProgress(index, total);
  }

  function handleDone() {
    const result = state.result;
    if (!result) return;

    updateStats();

    if (state.loggedRunId !== state.runId) {
      state.loggedRunId = state.runId;
      addLog(result);
    }

    if (result.ok) {
      setOpBadge('done', OP_META[result.op].label + ' ' + result.value + ' · 完成');
    } else {
      setOpBadge('error', OP_META[result.op].label + ' ' + result.value + ' · 未生效');
    }
  }

  function syncPlaybackUI(snapshot) {
    const atEnd = snapshot.total > 0 && snapshot.index >= snapshot.total - 1;
    els.btnPlay.textContent = snapshot.playing ? '暂停' : snapshot.done && atEnd ? '重播' : '播放';
    els.btnPlay.classList.toggle('is-playing', snapshot.playing);
    els.btnPrev.disabled = snapshot.index <= 0;
    els.btnNext.disabled = !snapshot.total || snapshot.index >= snapshot.total - 1;
    els.btnFinish.disabled = !snapshot.total || snapshot.done;
  }

  function currentDuration() {
    return SPEEDS[Number(els.speedInput.value) - 1] || 650;
  }

  function syncSpeed() {
    const ms = currentDuration();
    els.speedLabel.textContent = ms + ' ms / 步';
    player.setDuration(ms);
    renderer.setDuration(ms);
  }

  // ---------------------------------------------------------------------------
  // 操作流程
  // ---------------------------------------------------------------------------
  function submitOperation(op) {
    let input = els.searchInput;
    if (op === 'insert') input = els.insertInput;
    else if (op === 'delete') input = els.removeInput;

    const value = readValue(input);
    if (value === null) return;

    let result;
    if (op === 'insert') result = tree.insert(value);
    else if (op === 'delete') result = tree.remove(value);
    else result = tree.search(value);

    if (result.ok && op !== 'search') input.value = '';
    start(result);
  }

  function start(result) {
    // 若上一次操作还在播放，先跳到它的最后一帧，保证画面与真实树一致
    if (player.total && !player.done) player.finish();

    state.result = result;
    state.runId += 1;

    buildCode(result.code);
    els.codeTitle.textContent = OP_META[result.op].title;
    setOpBadge('running', OP_META[result.op].label + ' ' + result.value);
    setStatus(result.message);

    player.setDuration(currentDuration());
    player.load(result.steps);
    updateProgress(-1, result.steps.length);
    player.play();
  }

  function readValue(input) {
    const raw = input.value.trim();
    if (!raw) {
      setStatus('请先输入一个整数。');
      input.focus();
      return null;
    }
    if (!/^-?\d+$/.test(raw)) {
      setStatus('“' + raw + '” 不是整数：为了便于观察比较过程，这里只接受整数。');
      input.select();
      return null;
    }

    const value = Number(raw);
    if (!Number.isSafeInteger(value) || Math.abs(value) > 99999) {
      setStatus('数值请控制在 -99999 ~ 99999 之间。');
      input.select();
      return null;
    }
    return value;
  }

  function replaceTree(values, message) {
    player.stop();
    tree.reset(values);
    renderer.render(tree.snapshot(), null, 0);
    state.result = null;
    clearLog();
    clearCode();
    updateStats();
    updateProgress(-1, 0);
    setOpBadge('idle', '就绪');
    setStatus(message);
    syncPlaybackUI(player.state());
  }

  // ---------------------------------------------------------------------------
  // 视图更新
  // ---------------------------------------------------------------------------
  function setStatus(text) {
    els.statusMessage.textContent = text;
  }

  function setOpBadge(kind, text) {
    const classes = ['op-badge'];
    if (kind === 'idle') classes.push('is-idle');
    if (kind === 'warn') classes.push('is-warn');
    if (kind === 'error') classes.push('is-error');
    if (kind === 'done') classes.push('is-done');
    els.opBadge.className = classes.join(' ');
    els.opBadge.textContent = text;
  }

  function updateProgress(index, total) {
    const done = total ? Math.max(0, index + 1) : 0;
    els.progressFill.style.width = (total ? (done / total) * 100 : 0) + '%';
    els.progressText.textContent = done + ' / ' + total;
  }

  function updateStats() {
    els.statSize.textContent = String(tree.size);
    els.statHeight.textContent = String(tree.height());

    const balanced = tree.isBalanced();
    els.statBalanced.textContent = balanced ? '平衡' : '不平衡';
    els.statBalanced.classList.toggle('is-ok', balanced);
    els.statBalanced.classList.toggle('is-bad', !balanced);
  }

  function buildCode(lines) {
    els.codeList.textContent = '';
    const fragment = document.createDocumentFragment();

    lines.forEach((line) => {
      const item = document.createElement('li');
      item.textContent = line;
      fragment.appendChild(item);
    });

    els.codeList.appendChild(fragment);
  }

  function clearCode() {
    els.codeTitle.textContent = '伪代码';
    els.codeList.textContent = '';
  }

  function highlightCodeLine(line) {
    const items = els.codeList.children;
    for (let i = 0; i < items.length; i += 1) {
      items[i].classList.toggle('is-active', i === line);
    }
  }

  function addLog(result) {
    const empty = els.logList.querySelector('.log-empty');
    if (empty) empty.remove();

    const item = document.createElement('li');

    const mark = document.createElement('span');
    mark.className = 'log-mark' + (result.ok ? '' : ' is-error');
    mark.textContent = result.ok ? '✓' : '✕';

    const op = document.createElement('span');
    op.className = 'log-op';
    op.textContent = OP_META[result.op].label;

    const value = document.createElement('span');
    value.className = 'log-value';
    value.textContent = String(result.value);

    const note = document.createElement('span');
    note.className = 'log-op';
    if (result.ok) note.textContent = result.op === 'search' ? '找到' : '完成';
    else note.textContent = result.op === 'search' ? '未找到' : '未生效';

    item.appendChild(mark);
    item.appendChild(op);
    item.appendChild(value);
    item.appendChild(note);
    els.logList.insertBefore(item, els.logList.firstChild);

    while (els.logList.children.length > 24) {
      els.logList.removeChild(els.logList.lastElementChild);
    }
  }

  function clearLog() {
    els.logList.textContent = '';
    const empty = document.createElement('li');
    empty.className = 'log-empty';
    empty.textContent = '还没有操作';
    els.logList.appendChild(empty);
  }

  function randomValues() {
    const count = 9 + Math.floor(Math.random() * 5);
    const pool = new Set();
    while (pool.size < count) {
      pool.add(1 + Math.floor(Math.random() * 99));
    }

    const values = Array.from(pool);
    for (let i = values.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = values[i];
      values[i] = values[j];
      values[j] = tmp;
    }
    return values;
  }

  // ---------------------------------------------------------------------------
  // 事件
  // ---------------------------------------------------------------------------
  function togglePlay() {
    if (!player.total) {
      setStatus('请先执行一次插入、删除或查找。');
      return;
    }
    player.toggle();
  }

  function watchResize() {
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', () => renderer.rerender());
      return;
    }

    let lastWidth = els.stage.clientWidth;
    let frame = null;

    const observer = new ResizeObserver(() => {
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        const width = els.stage.clientWidth;
        if (width === lastWidth) return;
        lastWidth = width;
        renderer.rerender();
      });
    });

    observer.observe(els.stage);
  }

  els.insertForm.addEventListener('submit', (event) => {
    event.preventDefault();
    submitOperation('insert');
  });

  els.removeForm.addEventListener('submit', (event) => {
    event.preventDefault();
    submitOperation('delete');
  });

  els.searchForm.addEventListener('submit', (event) => {
    event.preventDefault();
    submitOperation('search');
  });

  els.modeInputs.forEach((input) => {
    input.addEventListener('change', () => {
      const avl = input.value === 'avl';
      tree.balanced = avl;
      els.modeHint.textContent = avl
        ? 'AVL 模式：每次增删后沿路径回溯并旋转，保证 |bf| ≤ 1。'
        : '普通 BST 模式：只按大小关系插入/删除，不旋转 —— 可以用它对比退化情况。';
      updateStats();
      setStatus(
        avl
          ? '已切换到 AVL 模式：之后的操作会保持平衡（现有节点不会被重新整理）。'
          : '已切换到普通 BST 模式：之后的操作不再旋转，树可能变得很不平衡。'
      );
    });
  });

  els.speedInput.addEventListener('input', syncSpeed);

  els.bfToggle.addEventListener('change', () => {
    renderer.setShowBF(els.bfToggle.checked);
  });

  els.btnPlay.addEventListener('click', togglePlay);
  els.btnPrev.addEventListener('click', () => player.prev());
  els.btnNext.addEventListener('click', () => player.next());
  els.btnFinish.addEventListener('click', () => player.finish());

  els.btnRandom.addEventListener('click', () => {
    replaceTree(randomValues(), '已随机生成一棵树。试试插入一个极端值，观察它是如何被旋转修正的。');
  });

  els.btnReset.addEventListener('click', () => {
    replaceTree(
      SEED_VALUES.slice(),
      '示例树已恢复。重置后分别试：插入 10 → 5（LL）、10 → 15（LR）、90 → 95（RR）、95 → 92（RL）。'
    );
  });

  els.btnClear.addEventListener('click', () => {
    replaceTree([], '树已清空。插入第一个节点，它会成为根。');
  });

  document.addEventListener('keydown', (event) => {
    const tag = event.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON') return;

    if (event.code === 'Space') {
      event.preventDefault();
      togglePlay();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      player.next();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      player.prev();
    }
  });

  // ---------------------------------------------------------------------------
  // 启动
  // ---------------------------------------------------------------------------
  function init() {
    renderer.setShowBF(els.bfToggle.checked);
    renderer.render(tree.snapshot(), null, 0);
    syncSpeed();
    syncPlaybackUI(player.state());
    updateStats();
    updateProgress(-1, 0);
    setOpBadge('idle', '就绪');
    clearCode();
    clearLog();
    setStatus('示例树 [50, 30, 70, 20, 40, 60, 80]。重置后分别试：插入 10 → 5（LL）、10 → 15（LR）、90 → 95（RR）、95 → 92（RL）；删除 50 可看后继替换。');
    watchResize();
  }

  init();
})();
