# Sequence CRDT Text Playground

A real-time, decentralized text editing simulator built with vanilla JavaScript. This playground demonstrates how two clients can collaboratively edit text without a central server, ensuring **Strong Eventual Consistency** through a Conflict-free Replicated Data Type (CRDT) algorithm.

## 🚀 Features

- **Side-by-Side Simulation**: Two independent editing environments (Client A and Client B).
- **Logoot-inspired CRDT**: Uses fractional indexing with unique site identifiers to resolve concurrent edits.
- **Offline Mode**: Toggle a client "Offline" to simulate network partitions. Edits are buffered locally and merged automatically upon reconnection.
- **Deep Visibility**:
  - **Operation logs**: Real-time trail of local and remote insertions/deletions.
  - **Internal State**: See the underlying fractional IDs assigned to every character.
- **Conflict Resolution**: Demonstrates that "conflicts" are mathematically impossible—all concurrent edits eventually converge to the same sequence of characters.

## 🛠️ Technology Stack

- **HTML5/CSS3**: Modern glassmorphism UI with smooth animations.
- **Vanilla JavaScript**: No frameworks or external dependencies.
- **Fractional Indexing**: A robust algorithm for decentralized sequence management.

## 📂 Project Structure

- `index.html`: Main layout and UI structure.
- `style.css`: Premium aesthetics and layout definitions.
- `crdt.js`: The core CRDT engine (`SequenceCRDT` class).
- `app.js`: Connects the UI events to the CRDT logic and handles network simulation.

## 🧩 How it Works

1. **Unique IDs**: Every character inserted is assigned a unique fractional ID (a list of numbers and site identifiers).
2. **Deterministic Ordering**: IDs are compared lexicographically. If two characters have different IDs, their relative order is fixed.
3. **Merging**: When a remote operation is received, the client finds the correct sorted position for the new character based on its ID and updates the text area.
4. **Offline Resilience**: When a client goes offline, outgoing operations are stored in a buffer. When coming back online, it "pulls" missed remote operations and "flushes" its local buffer to sync the state.

## 📖 Get Started

Simply open `index.html` in any modern web browser to start the playground!
