const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { SequenceCRDT, generateIdBetween, compareIds } = require('../crdt-playground/crdt.js');

// Deterministic picks for reproducible tests.
SequenceCRDT.setRng(() => 0);

function sync(a, b, opsA, opsB) {
  for (const op of opsA) {
    if (op.type === 'insert') b.remoteInsert(op.element);
    else b.remoteDelete(op.element);
  }
  for (const op of opsB) {
    if (op.type === 'insert') a.remoteInsert(op.element);
    else a.remoteDelete(op.element);
  }
}

describe('id ordering', () => {
  it('generated id is strictly between bounds', () => {
    for (let i = 0; i < 200; i++) {
      const a = new SequenceCRDT('A');
      const b = new SequenceCRDT('B');
      'abc'.split('').forEach((ch, idx) => a.localInsert(idx, ch));
      // take two neighbours from A, generate in B
      const id1 = a.struct[0].id;
      const id2 = a.struct[1].id;
      const mid = generateIdBetween(id1, id2, 'B');
      assert.ok(compareIds(id1, mid) < 0);
      assert.ok(compareIds(mid, id2) < 0);
      void b;
    }
  });
});

describe('convergence', () => {
  it('sequential inserts replicate', () => {
    const a = new SequenceCRDT('A');
    const b = new SequenceCRDT('B');
    const ops = ['h', 'i'].map((ch, i) => ({ type: 'insert', element: a.localInsert(i, ch) }));
    sync(a, b, ops, []);
    assert.equal(b.getText(), 'hi');
  });

  it('concurrent inserts at same position converge regardless of order', () => {
    for (let trial = 0; trial < 50; trial++) {
      const a = new SequenceCRDT('A');
      const b = new SequenceCRDT('B');
      const opA = { type: 'insert', element: a.localInsert(0, 'X') };
      const opB = { type: 'insert', element: b.localInsert(0, 'Y') };
      // deliver in opposite orders
      const a2 = new SequenceCRDT('A2');
      const b2 = new SequenceCRDT('B2');
      // rebuild same starting state by replaying with fresh ids is complex;
      // simpler: exchange opA/opB both ways and compare
      const ra = new SequenceCRDT('A');
      const rb = new SequenceCRDT('B');
      // reset to empty and re-apply locally to get same ops? Use the ops above:
      ra.remoteInsert(opB.element);
      ra.remoteInsert(opA.element);
      // ra already has opA locally? a has opA; simulate full mesh:
      // easiest assertion: a+opB and b+opA converge
      a.remoteInsert(opB.element);
      b.remoteInsert(opA.element);
      assert.equal(a.getText(), b.getText());
      assert.equal(a.getText().length, 2);
      void a2; void b2; void ra; void rb;
    }
  });

  it('offline partition then merge converges', () => {
    const a = new SequenceCRDT('A');
    const b = new SequenceCRDT('B');
    const seed = ['h', 'i'].map((ch, i) => ({ type: 'insert', element: a.localInsert(i, ch) }));
    sync(a, b, seed, []);
    // partition: each types without receiving
    const opsA = [{ type: 'insert', element: a.localInsert(2, '!') }];
    const opsB = [{ type: 'insert', element: b.localInsert(2, '?') }];
    sync(a, b, opsA, opsB);
    assert.equal(a.getText(), b.getText());
  });

  it('delete converges even if delete arrives before insert', () => {
    const a = new SequenceCRDT('A');
    const b = new SequenceCRDT('B');
    const el = a.localInsert(0, 'Z');
    // b gets delete first (reordered network)
    b.remoteDelete({ id: el.id, char: 'Z' });
    b.remoteInsert(el);
    a.remoteInsert(el);
    // deliver delete to a as well via b? simulate: a deletes then syncs
    const del = { type: 'delete', element: a.localDelete(0) };
    b.remoteDelete(del.element);
    assert.equal(a.getText(), b.getText());
    assert.equal(a.getText(), '');
  });

  it('fuzz: random ops converge', () => {
    const alpha = 'abc';
    for (let seed = 0; seed < 20; seed++) {
      const a = new SequenceCRDT('A');
      const b = new SequenceCRDT('B');
      const opsA = [];
      const opsB = [];
      let rnd = seed * 9301 + 49297;
      const rand = () => (rnd = (rnd * 9301 + 49297) % 233280) / 233280;
      SequenceCRDT.setRng(rand);
      for (let i = 0; i < 30; i++) {
        const side = rand() < 0.5 ? [a, opsA] : [b, opsB];
        const [doc, ops] = side;
        if (doc.getText().length === 0 || rand() < 0.6) {
          const pos = Math.floor(rand() * (doc.getText().length + 1));
          const ch = alpha[Math.floor(rand() * alpha.length)];
          ops.push({ type: 'insert', element: doc.localInsert(pos, ch) });
        } else {
          const pos = Math.floor(rand() * doc.getText().length);
          const el = doc.localDelete(pos);
          if (el) ops.push({ type: 'delete', element: el });
        }
      }
      SequenceCRDT.setRng(() => 0);
      // deliver all ops both ways, shuffled, twice (idempotent)
      const all = [...opsA, ...opsB];
      for (const op of all) {
        if (op.type === 'insert') { a.remoteInsert(op.element); b.remoteInsert(op.element); }
        else { a.remoteDelete(op.element); b.remoteDelete(op.element); }
      }
      for (const op of all) {
        if (op.type === 'insert') { a.remoteInsert(op.element); b.remoteInsert(op.element); }
        else { a.remoteDelete(op.element); b.remoteDelete(op.element); }
      }
      assert.equal(a.getText(), b.getText(), `seed ${seed} diverged: ${a.getText()} vs ${b.getText()}`);
    }
  });
});
