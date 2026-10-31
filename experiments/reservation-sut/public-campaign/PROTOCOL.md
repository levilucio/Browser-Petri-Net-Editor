# Public adaptive reservation experiment

Freeze the policies below before executing any target. Use the original reservation
app, reference APN, five admitted HML formulas and four existing fault variants
from increment 54. Run the baseline on both transports first. Each target gets
32 automatic trials, eight explicit A trials and eight explicit B trials per
transport. Trial counts are fixed regardless of outcomes.

The frozen service implements a single reservation per installation. The lab
therefore provisions a fresh ordinary instance with a newly initialized database
for each trial. This assumes repeatable deployment of a public initial workflow.
A fresh instance does not recover the state of an earlier reservation. The test
client gets only a public URL. The baseline starts in normal mode. Fault selection
uses the existing server's deployment flags. A gateway allows only the four
business methods and static UI assets and rejects control headers. No trial
uses an entropy seed, database inspection, checkpoint or reset request.

After open/ready, the automatic policy invokes allocate. An A response triggers
a second reservation attempt for B, followed on refusal by finish. This checks
whether a refused reallocation disturbed the original allocation. A B response
goes directly to finish, giving the exact public history required for the frozen
B-receipt HML property. Manual trials request their declared warehouse after
open/ready. Stop immediately on a trace mismatch, operational error or budget
limit. No retries or extra samples based on observed target behaviour.

Use SATEL's compatible-marking trace oracle. Evaluate each eligible HML formula
on each individual trace. Count automatic allocation opportunities, observed A/B
or other outcomes, completion opportunities after B, and each explicit manual
choice separately. Record witnessed, counterexample and inconclusive evidence.
No branch absence, shared post-opening state, fairness or frequency requirement
is inferred from the samples. The transports sample entropy independently.
