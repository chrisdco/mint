'use strict';

// BASE defines the digit space per level. Large enough to make
// concurrent inserts at the same position unlikely to collide,
// small enough to keep IDs readable in the UI.
const BASE = 100000;

// Optional deterministic mode for tests. When set to a function,
// it is used instead of Math.random() to pick a digit in (n1, n2).
// Defaults to Math.random in the browser/demo.
let _rng = null;

function _pickInRange(n1, n2) {
  // returns integer in (n1, n2), exclusive
  const span = n2 - n1 - 1;
  if (span <= 0) throw new Error('empty range');
  const step = Math.min(10, span);
  const r = _rng ? _rng() : Math.random();
  return n1 + Math.floor(r * step) + 1;
}

function generateIdBetween(id1, id2, siteId) {
    const head1 = id1.length > 0 ? id1[0] : { digit: 0, siteId: '' };
    const head2 = id2.length > 0 ? id2[0] : { digit: BASE, siteId: '' };

    if (head1.digit !== head2.digit) {
        const n1 = head1.digit;
        const n2 = head2.digit;
        if (n2 - n1 > 1) {
            return [{ digit: _pickInRange(n1, n2), siteId }];
        } else {
            const tail1 = id1.slice(1);
            const tail2 = [];
            return [head1, ...generateIdBetween(tail1, tail2, siteId)];
        }
    } else {
        if (head1.siteId < head2.siteId) {
             const tail1 = id1.slice(1);
             return [head1, ...generateIdBetween(tail1, [], siteId)];
        } else if (head1.siteId === head2.siteId) {
             const tail1 = id1.slice(1);
             const tail2 = id2.slice(1);
             return [head1, ...generateIdBetween(tail1, tail2, siteId)];
        } else {
             throw new Error('id1 must be less than id2');
        }
    }
}

function compareIds(id1, id2) {
    for (let i = 0; i < Math.max(id1.length, id2.length); i++) {
        const n1 = id1[i] ? id1[i].digit : 0;
        const n2 = id2[i] ? id2[i].digit : 0;
        if (n1 !== n2) return n1 - n2;
        
        const s1 = id1[i] ? id1[i].siteId : "";
        const s2 = id2[i] ? id2[i].siteId : "";
        if (s1 !== s2) return s1 < s2 ? -1 : 1;
    }
    return 0;
}

class SequenceCRDT {
    constructor(siteId) {
        this.siteId = siteId;
        this.struct = [];
        // Deletes that arrived before their insert (reordering).
        // Without this, an out-of-order delete is dropped forever
        // and replicas diverge. Key = serialized id.
        this.pendingDeletes = new Set();
    }

    static keyOf(id) {
        return id.map(p => `${p.digit}:${p.siteId}`).join('|');
    }

    localInsert(index, char) {
        if (index < 0 || index > this.struct.length) throw new RangeError('insert index out of bounds');
        const id1 = index === 0 ? [] : this.struct[index - 1].id;
        const id2 = index === this.struct.length ? [] : this.struct[index].id;

        const newId = generateIdBetween(id1, id2, this.siteId);
        const element = { id: newId, char };
        
        this.struct.splice(index, 0, element);
        return element; 
    }

    localDelete(index) {
        if (index < 0 || index >= this.struct.length) return null;
        const element = this.struct[index];
        this.struct.splice(index, 1);
        return element; 
    }

    remoteInsert(element) {
        const key = SequenceCRDT.keyOf(element.id);
        const index = this.findIndex(element.id);
        const existing = this.struct[index];
        if (existing && compareIds(existing.id, element.id) === 0) return -1;
        this.struct.splice(index, 0, element);
        // Apply a delete that arrived early.
        if (this.pendingDeletes.has(key)) {
            this.pendingDeletes.delete(key);
            this.struct.splice(index, 1);
        }
        return index;
    }

    remoteDelete(element) {
        const index = this.findIndex(element.id);
        const existing = this.struct[index];
        if (existing && compareIds(existing.id, element.id) === 0) {
            this.struct.splice(index, 1);
            return index;
        }
        // Insert hasn't arrived yet — remember, don't drop.
        this.pendingDeletes.add(SequenceCRDT.keyOf(element.id));
        return -1;
    }

    findIndex(id) {
        for (let i = 0; i < this.struct.length; i++) {
            const cmp = compareIds(id, this.struct[i].id);
            if (cmp === 0) return i;
            if (cmp < 0) return i; 
        }
        return this.struct.length;
    }

    getText() {
        return this.struct.map(e => e.char).join('');
    }

    reset() {
        this.struct = [];
        this.pendingDeletes.clear();
    }
}

// Test hook: force deterministic digit picks (e.g. always lowest).
// Pass null to restore Math.random.
SequenceCRDT.setRng = function (fn) { _rng = fn; };

// Browser + Node (UMD-ish) without a bundler.
(function (root, factory) {
    const api = { SequenceCRDT, generateIdBetween, compareIds, BASE };
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    root.SequenceCRDT = SequenceCRDT;
    root.generateIdBetween = generateIdBetween;
    root.compareIds = compareIds;
    root.formatId = function(id) {
        return id.map(p => `${p.digit}${p.siteId}`).join('.');
    };
})(typeof window !== 'undefined' ? window : globalThis, null);
