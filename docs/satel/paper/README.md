# SATEL/APN paper working draft

See [reservation HML results](../../../experiments/reservation-sut/RESULTS.md) for the controlled comparison of public trace evidence and branching-property decisions.


The [HR claim–evidence–assumption matrix](hr-claim-evidence-assumptions.md) consolidates the later methods/gates, scaling, representative-sensitivity and negative-test experiments. It supplements this draft without changing its frozen B0 baseline or treating open correspondence obligations as proved.

Start with [main.tex](main.tex). The first substantive content is the proposed
baseline/semantic contract, with a thesis correspondence checklist, proof
obligations, existing evidence and a research roadmap. It is not a submission-ready
paper. [The review proposal](../paper-baseline-semantic-contract.md) is the shorter
place to discuss decisions before editing formal sections.

## Build

Install a TeX distribution with latexmk, pdfLaTeX, BibTeX and the standard packages
used in `main.tex`. From this directory:

```sh
latexmk -pdf -interaction=nonstopmode -halt-on-error -outdir=build main.tex
```

The review PDF is `build/main.pdf`. Generated files are ignored; commit the source,
not TeX auxiliary files. This build command also works in PowerShell. Overleaf can
compile the source folder with `main.tex` as the main document and pdfLaTeX as the
compiler. No shell-escape, external figures or custom fonts are required.

## Files and editing conventions

- `sections/01-introduction.tex`: question and intended contribution.
- `sections/02-contract.tex`: baseline, APN fragment and observation protocol.
- `sections/03-selection.tex`: whole-sequence obligations and admission.
- `sections/04-black-box.tex`: belief sets, HML evidence and P1/P2 targets.
- `sections/05-correspondence.tex`: exact thesis anchors, interpretation issues, P5.
- `sections/06-evidence.tex`: reported results and proposed X2/X3 experiments.
- `sections/07-roadmap.tex`: limitations and next writing increments.
- `references.bib`: verified thesis record and pinned project sources; related-work
  bibliography remains to be developed.
- `baseline.json`: immutable implementation/evidence references and source hashes.

Keep reported, newly reproduced, proposed and proved statements distinct. Do not
turn a proof obligation into a theorem until its assumptions and proof are reviewed.
Do not cite the historical campaign as newly executed on B0. The earlier evidence
matrix and audit remain on their own branch and are linked by immutable commit;
this paper does not copy or silently overwrite them.

The thesis's printed Def. 8.3.3 and the reduction-family coverage interpretation
need author review. Standard successor-state HML is the proposed paper convention,
not an asserted equivalence to every printed rule. See the review proposal for
PDF page offsets and retrieval provenance.

## Freeze policy

B0 is `f6a92c0e2a9364755393b9af5c1de70549354758`, not the later documentation commit
containing this paper. A repair or changed scientific configuration receives a new
identifier and a documented comparison. Per-experiment models, options, seeds,
selected suites and target versions still need their own retained manifest.
No new release/tag, runtime change or experiment is part of this draft.

The [warehouse/order baseline](../../../experiments/warehouse-sut/BASELINE_RESULTS.md)
adds a second domain and a preserved unseeded model-abstraction discrepancy.
It is an increment-52 supplement, not a rewrite of the historical B0 baseline.

[Warehouse scaling and mutation results](../../../experiments/warehouse-sut/SCALING_MUTATION_RESULTS.md)
add controlled three-axis measurements and separate canonical, post-refusal and
long-history fault detections (increment 53).
