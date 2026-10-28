---
'@replayablejs/config': minor
'@replayablejs/build': minor
'@replayablejs/runtime': minor
'@replayablejs/export': minor
---

Add Helix (adn), TikTok and Snapchat delivery networks. Helix and TikTok reuse the
AppLovin and Mintegral implementations while retaining independent configuration,
runtime identity and analytics routing. Snapchat uses its own CTA adapter, portrait
runtime policy, self-contained ZIP packaging and delivery validation.

Add per-network exportName labels, available to filename callbacks and templates,
without changing runtime or analytics identity. Reject case-only and Unicode-normalization export filename collisions. Document
project-specific filename labels through the existing callback, including Meta as
facebook, without changing network identity or default filenames. TikTok targets
manual adaptation of Mintegral-format uploads; real network acceptance requires
host testing.
