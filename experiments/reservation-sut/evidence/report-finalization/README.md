# Preserved reporting failure

The first mutation execution log reached all five properties for every variant /
transport, but the subsequent summary rejected incomplete persisted reports.
Four files contained earlier progress snapshots despite later completion messages.
No adapter/SUT baseline mismatch was observed. Classification: reporting or
workspace persistence failure; the precise underlying persistence cause was not
established. This is not evidence of an unseeded business-logic defect.

The original campaign source, execution log, summary rejection and file status /
hash inventory were captured before correction. The harness now atomically renames
report files and verifies final completion on readback. The whole baseline/mutant
campaign is rerun; incomplete first exports are excluded from final measurements.

A second attempt used atomic rename and successfully read back both completed
baselines in the same process; a later read nevertheless returned an incomplete
baseline. Atomic replacement alone did not resolve this environment's persistence
behaviour. The final campaign therefore writes all live reports to a separate
`RESERVATION_REPORT_DIR` outside the synchronized workspace. Only after the summary
verifies the complete set are the finished files copied into the repository once.
