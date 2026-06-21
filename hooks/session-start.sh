#!/usr/bin/env bash
# Inject a short note so the agent knows vibegroup is available this session.
cat <<'NOTE'
{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"vibegroup is available: use vibegroup_peers to see room members, vibegroup_ask to ask a peer (returns a qid), and vibegroup_inbox to collect answers. Incoming peer questions are answered automatically by a read-only responder."}}
NOTE
