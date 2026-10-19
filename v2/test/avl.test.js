/*
 * AVL 核心逻辑测试（零依赖，直接 `node test/avl.test.js` 运行）
 */
'use strict';

const assert = require('assert');
const { AVLTree } = require('../js/avl.js');

let passed = 0;

function test(name, fn) {
  fn();
  passed += 1;
  console.log(`  ok   ${name}`);
}

function assertBst(node) {
  if (!node) return;
  if (node.left) assert.ok(node.left.key < node.key, 'left child must be smaller');
  if (node.right) assert.ok(node.right.key > node.key, 'right child must be larger');
  assertBst(node.left);
  assertBst(node.right);
}

function assertSnapshotBst(node) {
  if (!node) return;
  if (node.left) assert.ok(node.left.key < node.key);
  if (node.right) assert.ok(node.right.key > node.key);
  assertSnapshotBst(node.left);
  assertSnapshotBst(node.right);
}

function assertBalancedTree(tree) {
  assert.ok(tree.isBalanced(), 'AVL tree must stay balanced');
  assertBst(tree.root);
}

function collectKinds(steps) {
  return steps.map((step) => step.kind);
}

console.log('AVL core');

test('insert builds a valid AVL tree', () => {
  const tree = new AVLTree();
  [50, 30, 70, 20, 40, 60, 80].forEach((value) => {
    const result = tree.insert(value);
    assert.ok(result.ok);
  });
  assertBalancedTree(tree);
  assert.deepStrictEqual(tree.inOrder(), [20, 30, 40, 50, 60, 70, 80]);
  assert.strictEqual(tree.size, 7);
  assert.strictEqual(tree.height(), 3);
});

test('LL rotation', () => {
  const tree = new AVLTree();
  [30, 20, 10].forEach((v) => tree.insert(v));
  assert.strictEqual(tree.root.key, 20);
  assertBalancedTree(tree);
});

test('RR rotation', () => {
  const tree = new AVLTree();
  [10, 20, 30].forEach((v) => tree.insert(v));
  assert.strictEqual(tree.root.key, 20);
  assertBalancedTree(tree);
});

test('LR rotation', () => {
  const tree = new AVLTree();
  tree.insert(30);
  tree.insert(10);
  const result = tree.insert(20);
  assert.ok(collectKinds(result.steps).includes('rotate'));
  assert.strictEqual(tree.root.key, 20);
  assertBalancedTree(tree);
});

test('RL rotation', () => {
  const tree = new AVLTree();
  [10, 30, 20].forEach((v) => tree.insert(v));
  assert.strictEqual(tree.root.key, 20);
  assertBalancedTree(tree);
});

test('duplicate insert is rejected without changing the tree', () => {
  const tree = new AVLTree({ values: [10, 5, 15] });
  const before = JSON.stringify(tree.snapshot());
  const result = tree.insert(10);
  assert.strictEqual(result.ok, false);
  assert.strictEqual(JSON.stringify(tree.snapshot()), before);
  assert.strictEqual(result.steps[result.steps.length - 1].kind, 'duplicate');
});

test('delete leaf / single child / two children', () => {
  const tree = new AVLTree({ values: [50, 30, 70, 20, 40, 60, 80, 65, 90] });

  assert.strictEqual(tree.remove(20).ok, true);   // leaf
  assertBalancedTree(tree);
  assert.deepStrictEqual(tree.inOrder(), [30, 40, 50, 60, 65, 70, 80, 90]);

  assert.strictEqual(tree.remove(90).ok, true);   // leaf
  assertBalancedTree(tree);

  assert.strictEqual(tree.remove(60).ok, true);   // one child (65)
  assertBalancedTree(tree);
  assert.deepStrictEqual(tree.inOrder(), [30, 40, 50, 65, 70, 80]);

  assert.strictEqual(tree.remove(50).ok, true);   // two children
  assertBalancedTree(tree);
  assert.deepStrictEqual(tree.inOrder(), [30, 40, 65, 70, 80]);
});

test('delete missing value reports failure and keeps tree intact', () => {
  const tree = new AVLTree({ values: [10, 5, 15] });
  const result = tree.remove(99);
  assert.strictEqual(result.ok, false);
  assert.deepStrictEqual(tree.inOrder(), [5, 10, 15]);
  assert.strictEqual(result.steps[result.steps.length - 1].kind, 'not-found');
});

test('removing the root of a two-child tree works', () => {
  const tree = new AVLTree({ values: [20, 10, 30, 25, 40] });
  tree.remove(20);
  assertBalancedTree(tree);
  assert.deepStrictEqual(tree.inOrder(), [10, 25, 30, 40]);
});

test('search records the visited path from the root', () => {
  const tree = new AVLTree({ values: [50, 30, 70, 20, 40, 60, 80] });
  const hit = tree.search(40);
  assert.strictEqual(hit.ok, true);
  assert.ok(hit.steps.length >= 2);
  hit.steps.forEach((step) => {
    assert.strictEqual(step.pathIds[0], tree.root.id, 'path always starts at the root');
  });

  const miss = tree.search(45);
  assert.strictEqual(miss.ok, false);
  assert.strictEqual(miss.steps[miss.steps.length - 1].kind, 'not-found');
});

test('every trace step is a consistent snapshot', () => {
  const tree = new AVLTree();
  const values = [42, 17, 68, 9, 23, 55, 81, 3, 12, 19, 27, 60, 75, 90, 1];
  values.forEach((value) => {
    const result = tree.insert(value);
    result.steps.forEach((step) => {
      assertSnapshotBst(step.tree);
      (function checkBf(node) {
        if (!node) return;
        assert.ok(Math.abs(node.bf) <= 1, `bf out of range at ${node.key}`);
        checkBf(node.left);
        checkBf(node.right);
      })(step.tree);
    });
    assert.deepStrictEqual(result.steps[result.steps.length - 1].tree, tree.snapshot());
  });
});

test('normal BST mode never rotates', () => {
  const tree = new AVLTree({ balanced: false });
  [10, 20, 30, 40, 50].forEach((value) => {
    const result = tree.insert(value);
    assert.ok(!collectKinds(result.steps).includes('rotate'));
    assert.ok(!collectKinds(result.steps).includes('rotated'));
  });
  assert.strictEqual(tree.height(), 5);
  assert.strictEqual(tree.isBalanced(), false);
  assert.strictEqual(tree.root.key, 10);
});

test('randomised insert/delete keeps AVL invariants', () => {
  const tree = new AVLTree();
  const alive = new Set();
  let seed = 20210726;

  const rand = (limit) => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed % limit;
  };

  for (let i = 0; i < 400; i += 1) {
    const value = rand(200);
    if (alive.has(value)) {
      const result = tree.remove(value);
      assert.strictEqual(result.ok, true);
      alive.delete(value);
    } else {
      const result = tree.insert(value);
      assert.strictEqual(result.ok, true);
      alive.add(value);
    }

    const sorted = Array.from(alive).sort((a, b) => a - b);
    assert.deepStrictEqual(tree.inOrder(), sorted);
    assert.strictEqual(tree.size, alive.size);
    assertBalancedTree(tree);

    if (alive.size > 0) {
      const lowerBound = Math.ceil(Math.log2(alive.size + 1));
      const upperBound = 1.44 * Math.log2(alive.size + 2);
      assert.ok(tree.height() >= lowerBound, 'height must respect the lower bound');
      assert.ok(tree.height() <= upperBound, 'height must respect the AVL bound');
    }
  }
});

test('reset rebuilds the tree from scratch', () => {
  const tree = new AVLTree({ values: [1, 2, 3, 4, 5] });
  tree.reset([60, 40, 80]);
  assert.deepStrictEqual(tree.inOrder(), [40, 60, 80]);
  assert.strictEqual(tree.height(), 2);
});

console.log(`\n${passed} tests passed`);
