---
description: Work with your vibegroup room (peers, ask, inbox, status)
---

Use the vibegroup MCP tools to collaborate with peer agents:

- `vibegroup_peers` — who is in the room and what they're working on
- `vibegroup_ask` — ask a peer a question (returns a qid; non-blocking)
- `vibegroup_inbox` — collect answers that have arrived
- `vibegroup_status` — your connection status
- `vibegroup_leave` — leave the room

To ask a peer: first call `vibegroup_peers` to find their peerId, then `vibegroup_ask`, then check `vibegroup_inbox` on a later turn for the answer.

$ARGUMENTS
