---
description: Allow the vibegroup channel on this machine (one-time, needs sudo), then join a room.
---

Make vibegroup runnable as a Claude Code channel on this machine, then join a room. The `vibegroup` CLI is on your PATH (provided by this plugin). Run these steps and report the result.

## 1. Allow the channel (one-time per machine, needs sudo)

Channels are admin-gated, so this merges the vibegroup entry into Claude Code's managed settings (`channelsEnabled: true` + `allowedChannelPlugins`) **without clobbering existing keys**:

```
vibegroup allowlist-json | sudo tee "$(vibegroup allowlist-path)" >/dev/null
```

The user is prompted for their password. If they decline, tell them they can instead launch with `--dangerously-load-development-channels` and skip this step.

## 2. Join a room

Ask the user whether to **create a new room** or **join an existing one**, and what short name to use (default: this repo's folder name).

- New room: `vibegroup join --name <name>` — prints a room + token to share with the crew.
- Existing: `vibegroup join <room> <token> --name <name>`

## 3. Finish

Tell the user to relaunch the session as a channel (no dev flag needed once step 1 is done):

```
claude --channels plugin:vibegroup@vibegroup
```

Then they can ask a peer: "use vibegroup_peers, then ask <name>'s agent what they're working on." Remind them to share the room + token from step 2 with their crew out-of-band.
