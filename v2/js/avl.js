/*
 * avl.js —— AVL / 普通二叉搜索树（纯数据结构，不含任何 DOM 代码）
 *
 * 设计要点：
 * 算法执行的每一步都会记录一份「树快照 + 高亮信息」，
 * 播放器只负责按顺序回放这些快照。逻辑与动画因此彻底解耦，
 * 「上一步 / 下一步 / 跳到结束」这类功能也就自然成立了。
 */
(function (global) {
  'use strict';

  let uid = 0;

  class AVLNode {
    constructor(key) {
      this.id = ++uid;      // 唯一 id：旋转 / 换位后仍能追踪同一个节点
      this.key = key;
      this.left = null;
      this.right = null;
      this.height = 1;
    }
  }

  const h = (node) => (node ? node.height : 0);
  const bf = (node) => (node ? h(node.left) - h(node.right) : 0);
  const ref = (node) => (node ? { id: node.id, key: node.key } : null);

  function updateHeight(node) {
    node.height = 1 + Math.max(h(node.left), h(node.right));
  }

  function rotateRight(y) {
    const x = y.left;
    const moved = x.right;
    x.right = y;
    y.left = moved;
    updateHeight(y);
    updateHeight(x);
    return x;
  }

  function rotateLeft(x) {
    const y = x.right;
    const moved = y.left;
    y.left = x;
    x.right = moved;
    updateHeight(x);
    updateHeight(y);
    return y;
  }

  function relink(tree, parent, oldChild, newChild) {
    if (!parent) {
      tree.root = newChild;
      return;
    }
    if (parent.left === oldChild) parent.left = newChild;
    else if (parent.right === oldChild) parent.right = newChild;
  }

  /** 把真实树转成只读快照，交给渲染层 */
  function snapshotOf(node) {
    if (!node) return null;
    const left = snapshotOf(node.left);
    const right = snapshotOf(node.right);
    return {
      id: node.id,
      key: node.key,
      height: node.height,
      bf: (left ? left.height : 0) - (right ? right.height : 0),
      left: left,
      right: right,
    };
  }

  // ---------------------------------------------------------------------------
  // 与动画同步的伪代码。索引被 trace 步骤引用，用于高亮当前执行行。
  // ---------------------------------------------------------------------------
  const INSERT_CODE = [
    'insert(key):',
    '  node = root; path = []',
    '  while node != null:',
    '    if key < node.key:  node = node.left',
    '    elif key > node.key: node = node.right',
    '    else: return              // duplicate, ignore',
    '  attach new Node(key) at the empty slot',
    '  for node in reversed(path):',
    '    node.height = 1 + max(h(left), h(right))',
    '    bf = h(left) - h(right)',
    '    if bf >  1: rotate right (LL) / left then right (LR)',
    '    if bf < -1: rotate left  (RR) / right then left (RL)',
    '  return root',
  ];

  const INSERT_LINES = {
    start: 1,
    goLeft: 3,
    goRight: 4,
    duplicate: 5,
    attach: 6,
    loopBack: 7,
    updateHeight: 8,
    balance: 9,
    leftHeavy: 10,
    rightHeavy: 11,
    done: 12,
  };

  const DELETE_CODE = [
    'remove(key):',
    '  node = root; path = []',
    '  while node != null and node.key != key:',
    '    path.push(node)',
    '    node = key < node.key ? node.left : node.right',
    '  if node == null: return     // not found',
    '  if node.left and node.right:',
    '    successor = min(node.right)',
    '    node.key = successor.key',
    '    node = successor          // now has <= 1 child',
    '  child = node.left || node.right',
    '  link(parent, child)         // detach node',
    '  for node in reversed(path):',
    '    node.height = 1 + max(h(left), h(right))',
    '    bf = h(left) - h(right)',
    '    if bf >  1: rotate right (LL / LR)',
    '    if bf < -1: rotate left  (RR / RL)',
    '  return root',
  ];

  const DELETE_LINES = {
    start: 1,
    walk: 3,
    notFound: 5,
    twoChildren: 6,
    successor: 7,
    copyKey: 8,
    detach: 11,
    updateHeight: 13,
    balance: 14,
    leftHeavy: 15,
    rightHeavy: 16,
    done: 17,
  };

  const SEARCH_CODE = [
    'search(key):',
    '  node = root',
    '  while node != null:',
    '    if key == node.key: return node   // found',
    '    node = key < node.key ? node.left : node.right',
    '  return null                         // not found',
  ];

  const SEARCH_LINES = {
    start: 1,
    loop: 2,
    found: 3,
    go: 4,
    notFound: 5,
  };

  // ---------------------------------------------------------------------------
  // trace：每一步都带一份树快照，播放时直接渲染快照即可
  // ---------------------------------------------------------------------------
  function createTrace(tree) {
    const steps = [];
    const trace = {
      steps: steps,
      // sticky：一次操作内持续保留的高亮，例如「刚插入的节点」「找到的节点」
      sticky: {},
      push(event) {
        steps.push(Object.assign({
          kind: 'step',
          focus: null,
          matched: null,
          inserted: null,
          removed: null,
          rotation: null,
          pathIds: [],
          line: -1,
          message: '',
        }, trace.sticky, event, { tree: snapshotOf(tree.root) }));
      },
    };
    return trace;
  }

  /**
   * 回溯到一个节点：先更新高度，再检查平衡因子，必要时旋转。
   * parent 是 node 在树中的父节点（node 为根时为 null），用于重新挂接子树。
   */
  function fixNode(node, parent, tree, trace, lines) {
    updateHeight(node);
    const balance = bf(node);

    trace.push({
      kind: 'height',
      focus: ref(node),
      line: lines.updateHeight,
      message: `回溯到 ${node.key}：height = 1 + max(${h(node.left)}, ${h(node.right)}) = ${node.height}`,
    });

    trace.push({
      kind: 'balance',
      focus: ref(node),
      line: lines.balance,
      message: `${node.key} 的平衡因子 bf = ${h(node.left)} − ${h(node.right)} = ${balance}`,
    });

    if (Math.abs(balance) < 2) return;

    if (balance > 1) {
      const left = node.left;
      const leftBalance = bf(left);

      if (leftBalance >= 0) {
        // LL：一次右旋
        trace.push({
          kind: 'rotate',
          focus: ref(node),
          rotation: { type: 'LL', at: ref(node) },
          line: lines.leftHeavy,
          message: `LL 型（bf = ${balance}，左孩子 bf = ${leftBalance} ≥ 0）：对 ${node.key} 右旋`,
        });
        const newRoot = rotateRight(node);
        relink(tree, parent, node, newRoot);
        trace.push({
          kind: 'rotated',
          focus: ref(newRoot),
          rotation: { type: 'LL', at: ref(newRoot) },
          line: lines.leftHeavy,
          message: `右旋完成：${newRoot.key} 成为这棵子树的新根`,
        });
      } else {
        // LR：先对左孩子左旋，再对 node 右旋
        trace.push({
          kind: 'rotate',
          focus: ref(node),
          rotation: { type: 'LR', at: ref(node) },
          line: lines.leftHeavy,
          message: `LR 型（bf = ${balance}，左孩子 bf = ${leftBalance} < 0）：先对 ${left.key} 左旋`,
        });
        node.left = rotateLeft(left);
        trace.push({
          kind: 'rotate',
          focus: ref(node),
          rotation: { type: 'LR', at: ref(node) },
          line: lines.leftHeavy,
          message: `内层左旋完成：${left.key} 沉到 ${node.key} 的左子树下，再对 ${node.key} 右旋`,
        });
        const newRoot = rotateRight(node);
        relink(tree, parent, node, newRoot);
        trace.push({
          kind: 'rotated',
          focus: ref(newRoot),
          rotation: { type: 'LR', at: ref(newRoot) },
          line: lines.leftHeavy,
          message: `LR 双旋完成：${newRoot.key} 成为这棵子树的新根`,
        });
      }
      return;
    }

    const right = node.right;
    const rightBalance = bf(right);

    if (rightBalance <= 0) {
      // RR：一次左旋
      trace.push({
        kind: 'rotate',
        focus: ref(node),
        rotation: { type: 'RR', at: ref(node) },
        line: lines.rightHeavy,
        message: `RR 型（bf = ${balance}，右孩子 bf = ${rightBalance} ≤ 0）：对 ${node.key} 左旋`,
      });
      const newRoot = rotateLeft(node);
      relink(tree, parent, node, newRoot);
      trace.push({
        kind: 'rotated',
        focus: ref(newRoot),
        rotation: { type: 'RR', at: ref(newRoot) },
        line: lines.rightHeavy,
        message: `左旋完成：${newRoot.key} 成为这棵子树的新根`,
      });
    } else {
      // RL：先对右孩子右旋，再对 node 左旋
      trace.push({
        kind: 'rotate',
        focus: ref(node),
        rotation: { type: 'RL', at: ref(node) },
        line: lines.rightHeavy,
        message: `RL 型（bf = ${balance}，右孩子 bf = ${rightBalance} > 0）：先对 ${right.key} 右旋`,
      });
      node.right = rotateRight(right);
      trace.push({
        kind: 'rotate',
        focus: ref(node),
        rotation: { type: 'RL', at: ref(node) },
        line: lines.rightHeavy,
        message: `内层右旋完成：${right.key} 沉到 ${node.key} 的右子树下，再对 ${node.key} 左旋`,
      });
      const newRoot = rotateLeft(node);
      relink(tree, parent, node, newRoot);
      trace.push({
        kind: 'rotated',
        focus: ref(newRoot),
        rotation: { type: 'RL', at: ref(newRoot) },
        line: lines.rightHeavy,
        message: `RL 双旋完成：${newRoot.key} 成为这棵子树的新根`,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // AVLTree
  // ---------------------------------------------------------------------------
  class AVLTree {
    constructor(options) {
      const opts = options || {};
      this.balanced = opts.balanced !== false;   // false = 普通二叉搜索树模式
      this.root = null;
      if (Array.isArray(opts.values)) {
        opts.values.forEach((value) => this._insertSilent(value));
      }
    }

    // ---- 只读信息 ----------------------------------------------------------
    get size() {
      let count = 0;
      (function walk(node) {
        if (!node) return;
        count += 1;
        walk(node.left);
        walk(node.right);
      })(this.root);
      return count;
    }

    height() {
      return h(this.root);
    }

    isBalanced() {
      let ok = true;
      (function walk(node) {
        if (!node || !ok) return;
        if (Math.abs(bf(node)) > 1) {
          ok = false;
          return;
        }
        walk(node.left);
        walk(node.right);
      })(this.root);
      return ok;
    }

    inOrder() {
      const out = [];
      (function walk(node) {
        if (!node) return;
        walk(node.left);
        out.push(node.key);
        walk(node.right);
      })(this.root);
      return out;
    }

    contains(key) {
      let node = this.root;
      while (node) {
        if (key === node.key) return true;
        node = key < node.key ? node.left : node.right;
      }
      return false;
    }

    snapshot() {
      return snapshotOf(this.root);
    }

    /** 静默插入：初始化 / 随机生成时使用，不产生动画步骤 */
    _insertSilent(key) {
      const balanced = this.balanced;
      const insert = (node) => {
        if (!node) return new AVLNode(key);
        if (key < node.key) node.left = insert(node.left);
        else if (key > node.key) node.right = insert(node.right);
        else return node;

        updateHeight(node);
        if (!balanced) return node;

        const balance = bf(node);
        if (balance > 1) {
          if (bf(node.left) < 0) node.left = rotateLeft(node.left);
          return rotateRight(node);
        }
        if (balance < -1) {
          if (bf(node.right) > 0) node.right = rotateRight(node.right);
          return rotateLeft(node);
        }
        return node;
      };
      this.root = insert(this.root);
    }

    reset(values) {
      this.root = null;
      (values || []).forEach((value) => this._insertSilent(value));
    }

    // ---- 插入 --------------------------------------------------------------
    insert(key) {
      const trace = createTrace(this);
      const code = INSERT_CODE;
      const lines = INSERT_LINES;

      if (this.root === null) {
        this.root = new AVLNode(key);
        trace.sticky.inserted = ref(this.root);
        trace.push({
          kind: 'inserted',
          focus: ref(this.root),
          inserted: ref(this.root),
          line: lines.attach,
          message: `树为空：${key} 直接成为根节点`,
        });
        return this._result('insert', true, key, code, trace, `插入 ${key} 完成`);
      }

      const path = [];
      let cur = this.root;

      while (cur) {
        if (key === cur.key) {
          trace.push({
            kind: 'duplicate',
            focus: ref(cur),
            matched: ref(cur),
            pathIds: path.map((n) => n.id).concat(cur.id),
            line: lines.duplicate,
            message: `${key} 已经在树中，插入被忽略`,
          });
          return this._result('insert', false, key, code, trace, `${key} 已存在`);
        }

        path.push(cur);
        const goLeft = key < cur.key;
        trace.push({
          kind: 'compare',
          focus: ref(cur),
          pathIds: path.map((n) => n.id),
          line: goLeft ? lines.goLeft : lines.goRight,
          message: `${key} ${goLeft ? '<' : '>'} ${cur.key}：向${goLeft ? '左' : '右'}走`,
        });
        cur = goLeft ? cur.left : cur.right;
      }

      const parent = path[path.length - 1];
      const node = new AVLNode(key);
      if (key < parent.key) parent.left = node;
      else parent.right = node;
      trace.sticky.inserted = ref(node);   // 整个插入过程中都标出新节点

      trace.push({
        kind: 'inserted',
        focus: ref(node),
        inserted: ref(node),
        pathIds: path.map((n) => n.id).concat(node.id),
        line: lines.attach,
        message: `在空位挂上新节点 ${key}（${parent.key} 的${key < parent.key ? '左' : '右'}孩子）`,
      });

      if (this.balanced) {
        for (let i = path.length - 1; i >= 0; i -= 1) {
          fixNode(path[i], i > 0 ? path[i - 1] : null, this, trace, lines);
        }
      } else {
        for (let i = path.length - 1; i >= 0; i -= 1) {
          updateHeight(path[i]);
          trace.push({
            kind: 'height',
            focus: ref(path[i]),
            line: lines.updateHeight,
            message: `普通二叉树模式：更新 ${path[i].key} 的 height = ${path[i].height}`,
          });
        }
      }

      trace.push({
        kind: 'done',
        line: lines.done,
        message: `插入 ${key} 完成：节点数 ${this.size}，树高 ${this.height()}`,
      });
      return this._result('insert', true, key, code, trace, `插入 ${key} 完成`);
    }

    // ---- 删除 --------------------------------------------------------------
    remove(key) {
      const trace = createTrace(this);
      const code = DELETE_CODE;
      const lines = DELETE_LINES;

      if (this.root === null) {
        trace.push({
          kind: 'not-found',
          line: lines.notFound,
          message: `树是空的，${key} 不存在`,
        });
        return this._result('delete', false, key, code, trace, `${key} 不在树中`);
      }

      const path = [];
      let cur = this.root;

      while (cur && cur.key !== key) {
        path.push(cur);
        const goLeft = key < cur.key;
        trace.push({
          kind: 'compare',
          focus: ref(cur),
          pathIds: path.map((n) => n.id),
          line: lines.walk,
          message: `${key} ${goLeft ? '<' : '>'} ${cur.key}：向${goLeft ? '左' : '右'}走`,
        });
        cur = goLeft ? cur.left : cur.right;
      }

      if (!cur) {
        trace.push({
          kind: 'not-found',
          line: lines.notFound,
          message: `走到空节点：${key} 不在树中`,
        });
        return this._result('delete', false, key, code, trace, `${key} 不在树中`);
      }

      trace.push({
        kind: 'found',
        focus: ref(cur),
        matched: ref(cur),
        pathIds: path.map((n) => n.id).concat(cur.id),
        line: lines.start,
        message: `找到 ${cur.key}，准备删除`,
      });

      // chain 从根到「真正被摘掉的节点的父节点」，用于自底向上回溯
      const chain = path.slice();
      let target = cur;
      let parent = path.length ? path[path.length - 1] : null;

      if (target.left && target.right) {
        chain.push(target);
        trace.push({
          kind: 'two-children',
          focus: ref(target),
          line: lines.twoChildren,
          message: `${target.key} 有两个孩子：找右子树里的最小节点来顶替它`,
        });

        const replacedKey = target.key;
        let successorParent = target;
        let successor = target.right;

        while (successor.left) {
          chain.push(successor);
          successorParent = successor;
          successor = successor.left;
          trace.push({
            kind: 'compare',
            focus: ref(successor),
            line: lines.successor,
            message: `继续向左：${successor.key} 更小，候选最小节点更新为 ${successor.key}`,
          });
        }

        trace.push({
          kind: 'successor',
          focus: ref(successor),
          matched: ref(successor),
          line: lines.successor,
          message: `右子树最小节点是 ${successor.key}`,
        });

        target.key = successor.key;
        trace.push({
          kind: 'copied',
          focus: ref(target),
          matched: ref(successor),
          line: lines.copyKey,
          message: `把 ${successor.key} 写进原来 ${replacedKey} 所在的节点，接着删除 ${successor.key} 的原节点`,
        });

        parent = successorParent;
        target = successor;
      }

      const child = target.left || target.right;

      trace.push({
        kind: 'detaching',
        focus: ref(target),
        removed: ref(target),
        line: lines.detach,
        message: `${target.key} 最多只有一个孩子，直接摘掉它`,
      });

      if (parent) {
        if (parent.left === target) parent.left = child;
        else parent.right = child;
      } else {
        this.root = child;
      }

      trace.push({
        kind: 'removed',
        removed: ref(target),
        line: lines.detach,
        message: child
          ? `节点已摘下：${child.key} 接替它的位置`
          : '节点已摘下：它是叶子，父节点的该侧变为空',
      });

      if (this.balanced) {
        for (let i = chain.length - 1; i >= 0; i -= 1) {
          fixNode(chain[i], i > 0 ? chain[i - 1] : null, this, trace, lines);
        }
      } else {
        for (let i = chain.length - 1; i >= 0; i -= 1) {
          updateHeight(chain[i]);
          trace.push({
            kind: 'height',
            focus: ref(chain[i]),
            line: lines.updateHeight,
            message: `普通二叉树模式：更新 ${chain[i].key} 的 height = ${chain[i].height}`,
          });
        }
      }

      trace.push({
        kind: 'done',
        line: lines.done,
        message: `删除 ${key} 完成：节点数 ${this.size}，树高 ${this.height()}`,
      });
      return this._result('delete', true, key, code, trace, `删除 ${key} 完成`);
    }

    // ---- 查找 --------------------------------------------------------------
    search(key) {
      const trace = createTrace(this);
      const code = SEARCH_CODE;
      const lines = SEARCH_LINES;

      if (this.root === null) {
        trace.push({
          kind: 'not-found',
          line: lines.notFound,
          message: `树是空的，${key} 不存在`,
        });
        return this._result('search', false, key, code, trace, `${key} 不在树中`);
      }

      const path = [];
      let cur = this.root;

      while (cur) {
        path.push(cur);
        if (key === cur.key) {
          trace.sticky.matched = ref(cur);
          trace.push({
            kind: 'found',
            focus: ref(cur),
            matched: ref(cur),
            pathIds: path.map((n) => n.id),
            line: lines.found,
            message: `命中 ${key}：比较了 ${path.length} 个节点（树高 ${this.height()}）`,
          });
          return this._result('search', true, key, code, trace, `找到 ${key}`);
        }

        const goLeft = key < cur.key;
        trace.push({
          kind: 'compare',
          focus: ref(cur),
          pathIds: path.map((n) => n.id),
          line: lines.go,
          message: `${key} ${goLeft ? '<' : '>'} ${cur.key}：排除${goLeft ? '右' : '左'}子树，向${goLeft ? '左' : '右'}走`,
        });
        cur = goLeft ? cur.left : cur.right;
      }

      trace.push({
        kind: 'not-found',
        pathIds: path.map((n) => n.id),
        line: lines.notFound,
        message: `走到空节点：${key} 不在树中，比较了 ${path.length} 个节点`,
      });
      return this._result('search', false, key, code, trace, `${key} 不在树中`);
    }

    _result(op, ok, value, code, trace, message) {
      return {
        op: op,
        ok: ok,
        value: value,
        code: code,
        steps: trace.steps,
        message: message,
      };
    }
  }

  const api = {
    AVLNode: AVLNode,
    AVLTree: AVLTree,
    INSERT_CODE: INSERT_CODE,
    DELETE_CODE: DELETE_CODE,
    SEARCH_CODE: SEARCH_CODE,
    snapshotOf: snapshotOf,
  };

  global.AVL = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
