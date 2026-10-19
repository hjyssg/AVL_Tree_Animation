/*
 * renderer.js —— 用原生 SVG 渲染树，自己算布局、自己做补间动画。
 * 输入永远是「快照 + 高亮描述」，不关心 AVL 算法细节。
 */
(function (global) {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const NODE_R = 21;
  const H_GAP = 72;      // 中序相邻节点的水平间距
  const V_GAP = 92;      // 层间距
  const PAD = 46;
  const MIN_HEIGHT = 380;

  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const clamp01 = (value) => (value < 0 ? 0 : value > 1 ? 1 : value);

  function svgEl(tag, attrs) {
    const node = document.createElementNS(NS, tag);
    if (attrs) {
      Object.keys(attrs).forEach((key) => node.setAttribute(key, attrs[key]));
    }
    return node;
  }

  /**
   * 中序遍历决定 x（BST 上严格单调，天然不重叠），深度决定 y。
   */
  function layoutTree(tree, stageWidth) {
    const items = [];
    let index = 0;
    let maxDepth = 0;

    (function walk(node, depth, parentId) {
      if (!node) return;
      walk(node.left, depth + 1, node.id);
      items.push({
        id: node.id,
        key: node.key,
        height: node.height,
        bf: node.bf,
        depth: depth,
        parentId: parentId,
        index: index,
      });
      index += 1;
      if (depth > maxDepth) maxDepth = depth;
      walk(node.right, depth + 1, node.id);
    })(tree, 0, null);

    const contentWidth = Math.max(0, (items.length - 1) * H_GAP);
    const width = Math.max(stageWidth, contentWidth + PAD * 2);
    const contentHeight = maxDepth * V_GAP + NODE_R * 2;
    const height = Math.max(MIN_HEIGHT, contentHeight + PAD * 2);
    const offsetX = (width - contentWidth) / 2;
    const offsetY = (height - maxDepth * V_GAP) / 2;

    items.forEach((item) => {
      item.x = offsetX + item.index * H_GAP;
      item.y = offsetY + item.depth * V_GAP;
    });

    return { items: items, width: width, height: height };
  }

  function highlightOf(step) {
    const s = step || {};
    const rotationAt = s.rotation && s.rotation.at ? s.rotation.at.id : null;
    return {
      focus: s.focus ? s.focus.id : null,
      matched: s.matched ? s.matched.id : null,
      inserted: s.inserted ? s.inserted.id : null,
      removed: s.removed ? s.removed.id : null,
      pathIds: new Set(s.pathIds || []),
      rotationId: rotationAt,
    };
  }

  class TreeRenderer {
    constructor(svg) {
      this.svg = svg;
      this.linkLayer = svgEl('g', { class: 'link-layer' });
      this.nodeLayer = svgEl('g', { class: 'node-layer' });
      this.svg.appendChild(this.linkLayer);
      this.svg.appendChild(this.nodeLayer);

      this.emptyText = svgEl('text', {
        class: 'empty-state',
        x: '50%',
        y: '50%',
        'text-anchor': 'middle',
        'dominant-baseline': 'middle',
      });
      this.emptyText.textContent = '空树 —— 输入一个数字开始';
      this.svg.appendChild(this.emptyText);

      this.nodeViews = new Map();   // id -> view
      this.linkViews = new Map();   // childId -> view
      this.anims = new Map();       // view -> tween
      this.frameId = null;

      this.duration = 600;
      this.showBf = true;
      this.snapshot = null;
      this.step = null;
      this.lastStageWidth = 960;
    }

    setShowBF(flag) {
      this.showBf = !!flag;
      this.svg.classList.toggle('hide-bf', !this.showBf);
    }

    setDuration(ms) {
      this.duration = ms;
    }

    /** 尺寸变化后按当前状态重画（不做动画） */
    rerender() {
      if (this.snapshot === null) {
        this.clear();
        this.render(null, null, 0);
        return;
      }
      this.render(this.snapshot, this.step, 0);
    }

    clear() {
      this.anims.clear();
      if (this.frameId !== null) {
        cancelAnimationFrame(this.frameId);
        this.frameId = null;
      }
      this.nodeViews.forEach((view) => {
        if (view.removeTimer) clearTimeout(view.removeTimer);
        view.el.remove();
      });
      this.linkViews.forEach((view) => {
        if (view.removeTimer) clearTimeout(view.removeTimer);
        view.el.remove();
      });
      this.nodeViews.clear();
      this.linkViews.clear();
    }

    render(snapshot, step, duration) {
      this.snapshot = snapshot;
      this.step = step || null;
      if (typeof duration === 'number') this.duration = duration;

      const stageWidth = Math.max(
        320,
        (this.svg.parentElement && this.svg.parentElement.clientWidth) || this.lastStageWidth
      );
      this.lastStageWidth = stageWidth;

      const layout = layoutTree(snapshot, stageWidth);
      this.svg.setAttribute('width', layout.width);
      this.svg.setAttribute('height', layout.height);
      this.svg.setAttribute('viewBox', '0 0 ' + layout.width + ' ' + layout.height);

      const animDur = this.duration <= 0 ? 0 : Math.max(120, Math.min(this.duration, 700));
      const hl = highlightOf(this.step);
      const present = new Set();

      // ---- 节点 ------------------------------------------------------------
      layout.items.forEach((item) => {
        present.add(item.id);
        let view = this.nodeViews.get(item.id);

        if (view && view.exiting) {
          // 之前正在淡出的节点又被重新用到：取消移除
          view.exiting = false;
          if (view.removeTimer) {
            clearTimeout(view.removeTimer);
            view.removeTimer = null;
          }
        }

        if (!view) {
          const parentView = item.parentId != null ? this.nodeViews.get(item.parentId) : null;
          view = this.createNodeView(item);
          if (parentView) {
            view.x = parentView.x;
            view.y = parentView.y;
          } else {
            view.x = item.x;
            view.y = item.y - 48;
          }
          view.opacity = 0;
          view.scale = 0.5;
          this.nodeViews.set(item.id, view);
          this.paintNode(view);
        }

        view.item = item;
        this.updateNodeMeta(view, item);
        this.applyNodeClasses(view, item.id, hl);
        this.tweenNode(view, item.x, item.y, 1, 1, animDur);
      });

      // ---- 连线 ------------------------------------------------------------
      const presentLinks = new Set();

      layout.items.forEach((item) => {
        if (item.parentId == null) return;
        presentLinks.add(item.id);

        let view = this.linkViews.get(item.id);
        if (view && view.exiting) {
          view.exiting = false;
          if (view.removeTimer) {
            clearTimeout(view.removeTimer);
            view.removeTimer = null;
          }
        }

        if (!view) {
          view = {
            el: svgEl('path', { class: 'link' }),
            parentId: item.parentId,
            childId: item.id,
            opacity: 0,
            exiting: false,
            removeTimer: null,
          };
          this.linkLayer.appendChild(view.el);
          this.linkViews.set(item.id, view);
        }

        view.parentId = item.parentId;
        view.el.classList.toggle(
          'is-path',
          hl.pathIds.has(item.parentId) && hl.pathIds.has(item.id)
        );
        this.tweenAttr(view, { opacity: 1 }, animDur);
      });

      this.linkViews.forEach((view, childId) => {
        if (presentLinks.has(childId) || view.exiting) return;
        view.exiting = true;

        if (animDur <= 0) {
          view.el.remove();
          this.linkViews.delete(childId);
          return;
        }

        this.tweenAttr(view, { opacity: 0 }, animDur);
        view.removeTimer = setTimeout(() => {
          view.removeTimer = null;
          this.anims.delete(view);
          view.el.remove();
          this.linkViews.delete(childId);
        }, animDur + 60);
      });

      // ---- 离场节点 --------------------------------------------------------
      this.nodeViews.forEach((view, id) => {
        if (present.has(id) || view.exiting) return;
        view.exiting = true;

        if (animDur <= 0) {
          view.el.remove();
          this.nodeViews.delete(id);
          return;
        }

        this.tweenNode(view, view.x, view.y, 0, 0.35, animDur);
        view.removeTimer = setTimeout(() => {
          view.removeTimer = null;
          this.anims.delete(view);
          view.el.remove();
          this.nodeViews.delete(id);
        }, animDur + 60);
      });

      this.emptyText.setAttribute('display', layout.items.length ? 'none' : '');
      this.nodeViews.forEach((view) => this.paintNode(view));
      this.paintLinks();
    }

    // ---- 视图 ------------------------------------------------------------
    createNodeView(item) {
      const el = svgEl('g', { class: 'node' });
      const circle = svgEl('circle', { class: 'node-circle', r: NODE_R });
      const keyText = svgEl('text', {
        class: 'node-key',
        'text-anchor': 'middle',
        dy: '0.35em',
      });
      const bfGroup = svgEl('g', {
        class: 'bf-badge',
        transform: 'translate(' + (NODE_R - 3) + ',' + (-NODE_R + 1) + ')',
      });
      const bfCircle = svgEl('circle', { r: 11 });
      const bfText = svgEl('text', { 'text-anchor': 'middle', dy: '0.35em' });
      const title = svgEl('title');

      bfGroup.appendChild(bfCircle);
      bfGroup.appendChild(bfText);
      el.appendChild(circle);
      el.appendChild(keyText);
      el.appendChild(bfGroup);
      el.appendChild(title);
      this.nodeLayer.appendChild(el);

      return {
        el: el,
        circle: circle,
        keyText: keyText,
        bfGroup: bfGroup,
        bfText: bfText,
        title: title,
        x: 0,
        y: 0,
        opacity: 0,
        scale: 1,
        exiting: false,
        removeTimer: null,
        item: null,
      };
    }

    updateNodeMeta(view, item) {
      view.keyText.textContent = String(item.key);
      view.bfText.textContent = (item.bf > 0 ? '+' : '') + item.bf;

      const level = Math.abs(item.bf);
      view.bfGroup.classList.toggle('is-zero', level === 0);
      view.bfGroup.classList.toggle('is-one', level === 1);
      view.bfGroup.classList.toggle('is-two', level >= 2);
      view.title.textContent = 'key ' + item.key + ' · height ' + item.height + ' · bf ' + item.bf;
    }

    applyNodeClasses(view, id, hl) {
      const el = view.el;
      el.classList.toggle('is-path', hl.pathIds.has(id));
      el.classList.toggle('is-focus', hl.focus === id);
      el.classList.toggle('is-rotating', hl.rotationId === id);
      el.classList.toggle('is-matched', hl.matched === id);
      el.classList.toggle('is-inserted', hl.inserted === id);
      el.classList.toggle('is-removed', hl.removed === id);
    }

    paintNode(view) {
      view.el.setAttribute(
        'transform',
        'translate(' + view.x.toFixed(2) + ',' + view.y.toFixed(2) + ') scale(' + view.scale.toFixed(3) + ')'
      );
      view.el.setAttribute('opacity', clamp01(view.opacity).toFixed(3));
    }

    paintLinks() {
      this.linkViews.forEach((view) => {
        const parent = this.nodeViews.get(view.parentId);
        const child = this.nodeViews.get(view.childId);
        if (!parent || !child) return;

        const dx = child.x - parent.x;
        const dy = child.y - parent.y;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len;
        const uy = dy / len;
        const x1 = parent.x + ux * NODE_R;
        const y1 = parent.y + uy * NODE_R;
        const x2 = child.x - ux * NODE_R;
        const y2 = child.y - uy * NODE_R;
        const midY = (y1 + y2) / 2;

        view.el.setAttribute(
          'd',
          'M' + x1.toFixed(2) + ',' + y1.toFixed(2) +
          ' C' + x1.toFixed(2) + ',' + midY.toFixed(2) +
          ' ' + x2.toFixed(2) + ',' + midY.toFixed(2) +
          ' ' + x2.toFixed(2) + ',' + y2.toFixed(2)
        );
        view.el.setAttribute('opacity', clamp01(view.opacity).toFixed(3));
      });
    }

    // ---- 补间 ------------------------------------------------------------
    tweenNode(view, x, y, opacity, scale, duration, onDone) {
      this.tweenAttr(view, { x: x, y: y, opacity: opacity, scale: scale }, duration, onDone);
    }

    tweenAttr(view, targets, duration, onDone) {
      const keys = Object.keys(targets);

      if (duration <= 0) {
        keys.forEach((key) => {
          view[key] = targets[key];
        });
        if (view.circle) this.paintNode(view);
        this.paintLinks();
        if (onDone) onDone();
        return;
      }

      const from = {};
      keys.forEach((key) => {
        from[key] = view[key];
      });
      this.anims.set(view, {
        from: from,
        targets: targets,
        start: performance.now(),
        duration: duration,
        onDone: onDone,
      });
      this.startLoop();
    }

    startLoop() {
      if (this.frameId !== null) return;

      const loop = (time) => {
        this.frameId = null;

        this.anims.forEach((anim, view) => {
          // rAF 的时间戳可能比 performance.now() 略早，所以要同时钳制上下界
          const progress = clamp01((time - anim.start) / anim.duration);
          const eased = easeOutCubic(progress);
          Object.keys(anim.targets).forEach((key) => {
            view[key] = anim.from[key] + (anim.targets[key] - anim.from[key]) * eased;
          });
          if (progress >= 1) {
            this.anims.delete(view);
            if (anim.onDone) anim.onDone();
          }
        });

        this.nodeViews.forEach((view) => this.paintNode(view));
        this.paintLinks();

        if (this.anims.size > 0) this.frameId = requestAnimationFrame(loop);
      };

      this.frameId = requestAnimationFrame(loop);
    }
  }

  global.TreeRenderer = TreeRenderer;
})(window);
