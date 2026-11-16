---
'@replayablejs/runtime': minor
---

Add setEventContext for declared analytics events. String context is copied into HTTP payload properties without overriding engine metadata; null clears it. Existing event names, integer values, and disabled analytics behavior remain compatible.
