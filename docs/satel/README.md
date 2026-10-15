# SATEL for Algebraic Petri Nets

SATEL is an experimental partial implementation of test selection from algebraic Petri nets. The editor supports **typed test intentions**: typed variables and stimulation/observation pairs.

## Start with the oracle-validated example

1. Load **Examples → SATEL Account — Reference**.
2. Open **SATEL → Oracle validation** and generate the refined suite. Four tests must pass the reference oracle before admission.
3. Close the panel and load an account mutant from Examples.
4. Reopen SATEL and replay the frozen suite. Inspect the first mismatching observation.

See [parameterized public methods](increment-04-public-methods.md) for the current execution contract, GUI review steps, and scope. [Increment 3](increment-03-initial-marking.md) describes the earlier direct-transition contract.

See [the GUI review guide](increment-02-gui-v2.md) for the exact steps, expected outcomes, V1 removal, and current limitations. [Increment 1](increment-01-symbolic-oracle.md) explains constructor/conditional-equation unfolding and its supported fragment. The CLI remains available with `cd petri-net-app && npm run satel:oracle-example`.

The classes are derived from ADT constructor patterns and conditional operation equations, not from enumerated executions. The account equation model and APN encoding are currently supplied by the example. General editor-ADT translation and symbolic generation from arbitrary intentions are not implemented yet.

## General intentions

Use **SATEL → Intentions** to create or edit a typed-variable intention. **Generate and validate suite** instantiates it, then checks every candidate on the reference APN. Failures/errors prevent admission and are shown in Results. An admitted suite can be replayed against the loaded APN with unchanged expectations.

The general generator/checker remains experimental and less restrictive than the account adapter. In particular, the manufacturing examples still have known semantic/test failures. Their presence in Examples does not imply all their intentions are correct.

V1 intention editing, generation, execution, and fixtures have been removed. Old V1 intentions are rejected, not automatically migrated. Historical design documents and videos describe earlier implementations and are not current behavior guarantees.
