const BASE = 100000;

function generateIdBetween(id1, id2, siteId) {
    const head1 = id1.length > 0 ? id1[0] : { digit: 0, siteId: "" };
    const head2 = id2.length > 0 ? id2[0] : { digit: BASE, siteId: "" };

    if (head1.digit !== head2.digit) {
        const n1 = head1.digit;
        const n2 = head2.digit;
        if (n2 - n1 > 1) {
            const step = Math.min(10, n2 - n1 - 1);
            const newDigit = n1 + Math.floor(Math.random() * step) + 1;
            return [{ digit: newDigit, siteId }];
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
             throw new Error("id1 must be less than id2");
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
    }

    localInsert(index, char) {
        const id1 = index === 0 ? [] : this.struct[index - 1].id;
        const id2 = index === this.struct.length ? [] : this.struct[index].id;

        const newId = generateIdBetween(id1, id2, this.siteId);
        const element = { id: newId, char };
        
        this.struct.splice(index, 0, element);
        return element; 
    }

    localDelete(index) {
        const element = this.struct[index];
        this.struct.splice(index, 1);
        return element; 
    }

    remoteInsert(element) {
        const index = this.findIndex(element.id);
        const existing = this.struct[index];
        if (existing && compareIds(existing.id, element.id) === 0) return -1;
        this.struct.splice(index, 0, element);
        return index;
    }

    remoteDelete(element) {
        const index = this.findIndex(element.id);
        const existing = this.struct[index];
        if (existing && compareIds(existing.id, element.id) === 0) {
            this.struct.splice(index, 1);
            return index;
        }
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
        return this.struct.map(e => e.char).join("");
    }
}

window.SequenceCRDT = SequenceCRDT;
window.formatId = function(id) {
    return id.map(p => `${p.digit}${p.siteId}`).join('.');
};
