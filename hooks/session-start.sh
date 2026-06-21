#!/usr/bin/env bash
# Inject a short note so the agent knows vibegroup is available this session.
cat <<'NOTE'
{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"vibegroup is connected. Peer questions arrive as <channel source=\"vibegroup\" kind=\"question\"> events — answer them read-only and reply with vibegroup_reply (passing the qid). To ask a peer, use vibegroup_peers then vibegroup_ask; their answer arrives as a <channel kind=\"answer\"> event."}}
NOTE
