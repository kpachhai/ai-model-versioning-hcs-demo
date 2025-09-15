# Demo Overview – Hedera Decision & AI Version Ledger

## 1. Purpose

This demo showcases how **Hedera Consensus Service (HCS)** can be used as an immutable, append‑only, publicly auditable event ledger for:

- Financial application lifecycle governance (ApplicationCreated, DecisionOverridden)
- AI / ML model provenance and evaluation transparency (AIVersionRegistered, AIVersionEvaluated)

It replaces implicit, mutable, siloed audit tables with **externally verifiable, timestamped events**. Anyone with the topic ID can independently query Hedera Mirror Nodes to reconstruct exactly what happened and when.

---

## 2. Core Problems Addressed

| Problem              | Traditional Risk               | Demo Approach                      |
| -------------------- | ------------------------------ | ---------------------------------- |
| Silent data edits    | DB updates hide original state | Append-only events on HCS          |
| Disputed timing      | Server clock logs              | Consensus timestamps               |
| Cross‑org trust      | “Trust us” / emailed logs      | Public Mirror Node replay          |
| AI provenance        | Unverifiable model claims      | Registered version + artifact hash |
| Governance overrides | Hidden manual actions          | Explicit override events           |
| Evaluation integrity | Post-hoc metric inflation      | Immutable evaluation snapshots     |

---

## 3. Event Types

| Category      | Type                | Description                                                   | Key Fields                                                             |
| ------------- | ------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Application   | ApplicationCreated  | New financial / business application intake                   | applicationId, amount, status=CREATED, timestamp                       |
| Application   | DecisionOverridden  | Human/manual governance action altering prior automated state | applicationId, reason, newStatus=OVERRIDDEN, timestamp                 |
| AI Governance | AIVersionRegistered | Public attestation of a model version artifact                | modelId, version, repoUrl, artifactHash, description, timestamp        |
| AI Governance | AIVersionEvaluated  | Logged evaluation metrics for a specific model version        | modelId, version, evalId, dataset, metrics{}, passed, notes, timestamp |

No hash chaining or signatures in this minimal version (kept intentionally simple). These can be extended.

---

## 4. Architecture (High Level)

```
+-----------+        REST JSON         +------------------+     HCS Submit      +------------------+
|  Browser  |  --->  /api/*  ------->  |   Node Backend   |  -----------------> | Hedera Consensus |
|  (Forms)  |                            (No DB required) |                     |     Service      |
+-----------+                           |                 | <------------------ |  (Finality + TS) |
        ^                               |                 |   Mirror Query      +------------------+
        |  Mirror Node Poll (HTTPS)     +------------------+
        |                |
        +----------------+
        Public Hedera Mirror Node
```

Key properties:

- Backend is stateless for historical audit (only ephemeral in-memory validation for overrides).
- Frontend does not query backend for history—pulls it from Mirror Node for authentic reconstruction.
- Each event is a plain JSON message (base64-encoded in HCS transport).

---

## 5. Data Flow

1. User submits form (create application, override, register model version, log evaluation).
2. Backend validates minimal fields, constructs JSON with `timestamp`.
3. Backend submits message to Hedera Topic via `TopicMessageSubmitTransaction`.
4. Hedera assigns consensus timestamp & ordering.
5. Mirror Node exposes the message via REST.
6. Frontend polling decodes & renders the event list.

---

## 6. Why “DecisionOverridden” Matters

Real systems feature automated scoring/decisions plus human exceptions:

- Regulatory or compliance adjustment
- Fraud detection escalation
- Policy/guideline override

Recording overrides as immutable entries creates a **governance trail**:

- Who (extend later with identity/signature)
- What (reason code or free-form reason)
- When (consensus timestamp)
- Why (business context / rationale)

---

## 7. AI Versioning Use Case

| Concern                                           | Solution via Events                                        |
| ------------------------------------------------- | ---------------------------------------------------------- |
| “This model version existed on date X.”           | AIVersionRegistered attestation                            |
| “Prove we evaluated the model before production.” | AIVersionEvaluated with metrics                            |
| “Demonstrate we didn’t inflate metrics later.”    | Mirror Node historical query equals original posted data   |
| “Which artifact hash was deployed?”               | artifactHash ties on-chain record to file/container digest |

---

## 8. Extensibility Options

| Enhancement                       | Benefit                                         |
| --------------------------------- | ----------------------------------------------- |
| ED25519 Signatures (per event)    | Non-repudiation of origin                       |
| Hash Chain / Merkle Accumulator   | Fast tamper-evidence inside UI                  |
| ModelDeprecated / Rollback events | Full lifecycle trace                            |
| RiskScoreComputed events          | Frequent algorithmic signals, later aggregated  |
| PolicySnapshot events             | Capture rules used at decision time             |
| Encrypted payload sections        | Confidential fields + public metadata split     |
| Replay CLI                        | Deterministic state reconstruction at any point |

---

## 9. Security & Integrity Considerations

| Aspect          | Current                                | Potential Upgrade                           |
| --------------- | -------------------------------------- | ------------------------------------------- |
| Authenticity    | Implicit (server key)                  | Sign with per-service keys                  |
| Integrity       | Hedera guarantees message immutability | Add hash chain for immediate local proof    |
| Confidentiality | All fields public                      | Encrypt sensitive fields, publish hash only |
| Availability    | Mirror Node + topic                    | Add multi-source or caching relays          |
| Non-repudiation | Not cryptographically enforced         | Include signature + signerID                |

---

## 10. Operational Notes

- Costs: Each event is a small HCS message—very low testnet cost; mainnet cost minimal for demos.
- Monitoring: You can add observability by tracking subject counts per minute or type trend lines off Mirror Node.
- Scaling: Event volume scaling is decoupled from business logic; you can shard by application vertical using multiple topics.

---

## 11. Limitations (Intentional in Minimal Demo)

| Limitation           | Reason                                    |
| -------------------- | ----------------------------------------- |
| No persistence / DB  | Focus purely on ledger concept            |
| No pagination in UI  | Simplicity; Mirror Node already paginates |
| No auth / ACL        | Demo scope                                |
| No signatures        | Reduce setup complexity                   |
| No schema versioning | Fields stable for minimal set             |

---

## 12. When to Use This Pattern

| Scenario                                     | Suitability                          |
| -------------------------------------------- | ------------------------------------ |
| Regulatory audit trails                      | High                                 |
| Multi-entity collaboration (banks, partners) | High                                 |
| Internal debugging only                      | Lower (logs may suffice)             |
| High-frequency telemetry                     | Consider batching / rollups          |
| Sensitive PII fields                         | Use hashing/encryption modifications |

---

## 13. Next Steps (If Productizing)

1. Add identity & signature per message.
2. Introduce versioned schema envelope `{schemaVersion, payload}`.
3. Build replay & verification CLI.
4. Integrate with pipeline (CI/CD) to auto-register model versions.
5. Provide GraphQL or search index over Mirror Node results.

---

## 14. TL;DR

This demo proves how HCS can shift critical decision and AI model provenance data from mutable internal silos to an immutable, low-latency, publicly auditable ledger—raising integrity, trust, and compliance readiness while remaining simple to adopt.
