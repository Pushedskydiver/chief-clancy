---
'@chief-clancy/terminal': minor
'@chief-clancy/dev': minor
---

Inherited change: published dependency range on `@chief-clancy/core` updates from `^0.1.x` to `^0.2.x` as core adopts the namespaced-subpath `exports` map. (Under pre-1.0 semver the two ranges are disjoint, not overlapping.) No API change in terminal or dev itself — this is a minor bump on the consumer-visible dep surface, not a patch.
