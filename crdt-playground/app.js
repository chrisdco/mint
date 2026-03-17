class NetworkSimulator {
    constructor() {
        this.clients = {}; 
        this.undelivered = {}; 
    }
    registerClient(client) {
         this.clients[client.id] = client;
         this.undelivered[client.id] = [];
    }
    broadcast(senderId, operation) {
         for (const [id, client] of Object.entries(this.clients)) {
             if (id !== senderId) {
                 if (client.isOnline) {
                     // small latency for realism
                     setTimeout(() => client.receiveOperation(operation), 10);
                 } else {
                     this.undelivered[id].push(operation);
                 }
             }
         }
    }
    pullMissed(clientId) {
         const ops = this.undelivered[clientId] || [];
         this.undelivered[clientId] = [];
         return ops;
    }
}

function diff(oldText, newText) {
    let start = 0;
    while (start < oldText.length && start < newText.length && oldText[start] === newText[start]) {
        start++;
    }
    
    let endOld = oldText.length - 1;
    let endNew = newText.length - 1;
    
    while (endOld >= start && endNew >= start && oldText[endOld] === newText[endNew]) {
        endOld--;
        endNew--;
    }
    
    return {
        start,
        removed: oldText.slice(start, endOld + 1),
        added: newText.slice(start, endNew + 1)
    };
}

class Client {
    constructor(id, simulator) {
        this.id = id;
        this.simulator = simulator;
        this.crdt = new SequenceCRDT(id);
        
        this.textarea = document.getElementById(`editor-${id}`);
        this.statusToggle = document.getElementById(`status-${id}`);
        this.logContainer = document.getElementById(`log-${id}`);
        this.internalBody = document.getElementById(`internal-${id}`);
        
        this.isOnline = true;
        this.buffer = [];

        this.textarea.addEventListener('input', (e) => this.handleInput(e));
        this.statusToggle.addEventListener('change', (e) => this.handleToggleStatus(e));
        
        this.simulator.registerClient(this);
    }

    handleToggleStatus(e) {
        this.isOnline = e.target.checked;
        this.log(`Toggled status to ${this.isOnline ? 'Online' : 'Offline'}`, 'status');
        
        if (this.isOnline) {
            // Fetch missed operations from the simulator
            const missed = this.simulator.pullMissed(this.id);
            if (missed.length > 0) {
                this.log(`Received ${missed.length} missed operations...`, 'status');
            }
            for (const op of missed) {
                this.receiveOperation(op);
            }
            
            // Flush buffered outgoing operations
            if (this.buffer.length > 0) {
                this.log(`Flushing ${this.buffer.length} local operations...`, 'status');
                for (const op of this.buffer) {
                    this.simulator.broadcast(this.id, op);
                }
                this.buffer = [];
            }
        }
    }

    handleInput(e) {
        const newText = this.textarea.value;
        const oldText = this.crdt.getText();
        
        const { start, removed, added } = diff(oldText, newText);

        for (let i = 0; i < removed.length; i++) {
            const element = this.crdt.localDelete(start);
            this.sendOperation({ type: 'delete', element });
        }
        
        for (let i = 0; i < added.length; i++) {
            const char = added[i];
            const element = this.crdt.localInsert(start + i, char);
            this.sendOperation({ type: 'insert', element: element });
        }
        
        this.updateUI(added.length > 0 ? start + added.length - 1 : -1);
    }

    sendOperation(op) {
        const readableChar = op.element.char === '\n' ? '\\n' : op.element.char;
        this.log(`Local ${op.type} '${readableChar}' at ${formatId(op.element.id)}`, op.type);
        if (this.isOnline) {
            this.simulator.broadcast(this.id, op);
        } else {
            this.buffer.push(op);
        }
    }

    receiveOperation(op) {
        let index = -1;
        if (op.type === 'insert') {
            index = this.crdt.remoteInsert(op.element);
        } else if (op.type === 'delete') {
            index = this.crdt.remoteDelete(op.element);
        }
        
        if (index !== -1) {
            const readableChar = op.element.char === '\n' ? '\\n' : op.element.char;
            this.log(`Remote ${op.type} '${readableChar}'`, op.type);
           
            const selectionStart = this.textarea.selectionStart;
            const selectionEnd = this.textarea.selectionEnd;
           
            this.textarea.value = this.crdt.getText();
           
            if (op.type === 'insert' && index <= selectionStart) {
                this.textarea.setSelectionRange(selectionStart + 1, selectionEnd + 1);
            } else if (op.type === 'delete' && index < selectionStart) {
                this.textarea.setSelectionRange(selectionStart - 1, selectionEnd - 1);
            } else {
                this.textarea.setSelectionRange(selectionStart, selectionEnd);
            }
            this.updateUI(op.type === 'insert' ? index : -1);
        }
    }

    log(message, type = 'info') {
        const li = document.createElement('li');
        const time = new Date().toLocaleTimeString([], {hour12:false, hour:'2-digit', minute:'2-digit', second:'2-digit'});
        li.textContent = `[${time}] ${message}`;
        if (type === 'insert') li.className = 'log-insert';
        if (type === 'delete') li.className = 'log-delete';
        if (type === 'status') li.className = 'log-status';
        this.logContainer.appendChild(li);
        this.logContainer.scrollTop = this.logContainer.scrollHeight;
    }

    updateUI(flashIndex = -1) {
        this.internalBody.innerHTML = '';
        this.crdt.struct.forEach((e, i) => {
            const tr = document.createElement('tr');
            if (i === flashIndex) {
                 tr.className = 'flash-row';
            }
            
            let displayChar = e.char;
            if (e.char === ' ') displayChar = '&nbsp;';
            else if (e.char === '\n') displayChar = '\\n';
            
            tr.innerHTML = `<td>${displayChar}</td><td>${formatId(e.id)}</td>`;
            this.internalBody.appendChild(tr);
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
   const sim = new NetworkSimulator();
   const clientA = new Client('A', sim);
   const clientB = new Client('B', sim);
   clientA.updateUI();
   clientB.updateUI();
});
