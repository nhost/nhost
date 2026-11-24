Fixed seed `712`, requested sample size 30. The first detector run after excluding `undefined` and local `*ClassNames` has **4 findings**, so all 4 were audited (no random subsampling). Duplicate subjects were identified by `(file, rule, subject, source-order index)` rather than collapsed by their baseline key: the two `Badge WARNING_BADGE` findings are separately at the two JSX uses, and the two `Button getModeButtonClassName()` findings have the same normalized subject but distinct source positions. The baseline retains counts for identical keys.

| Kind | Count | Result |
| --- | ---: | --- |
| Glued interpolation | 0 | No dashboard sites in scope |
| Component identifier | 2 | `WARNING_BADGE` is a same-file constant outside the naming convention; its strings are invisible to the class-site prelude. Both uses are real. |
| Component member | 0 | No dashboard sites |
| Component call | 2 | `getModeButtonClassName()` is a non-helper call on `Button`. Both calls are real and not inspectable at the JSX site. |
| Component conditional/logical branch | 0 | No dashboard sites |

**False positives: 0/4.** The fixture suite covers all kinds absent from the dashboard. The original seven-findings probe also exposed three false positives: two local `*ClassNames` constants and the `undefined` side of a conditional. The shipped detector exempts these and was audited again before seeding. No existing violations were fixed in this phase.
