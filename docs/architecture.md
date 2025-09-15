# Architecture & Design Document

## 1. Scope

This document provides a deeper technical view of the **Hedera Decision & AI Version Ledger** demo:

- Component architecture
- Data model
- Event submission pipeline
- Operational concerns
- Extension paths

## 2. Components

| Component                | Responsibility                                     | Notes                                                   |
| ------------------------ | -------------------------------------------------- | ------------------------------------------------------- |
| Frontend (Static, JS)    | Provide forms, poll Mirror Node, render events     | Stateless, no local persistence                         |
| Backend (Node/Express)   | REST API; minimal validation; submit events to HCS | No database; ephemeral process memory for simple checks |
| Hedera Consensus Service | Immutable message ordering & timestamps            | Topic auto-created or reused via env                    |
| Mirror Node (Testnet)    | Public API to retrieve consensus messages          | Frontend reads directly for authenticity                |

## 3. Data Model (Events)

All events are plain JSON objects with a minimal required field set plus a `timestamp` generated server-side (milliseconds since epoch). HCS adds authoritative consensus timestamps separately (retrievable from Mirror Node).

### 3.1 ApplicationCreated

```json
{
  "type": "ApplicationCreated",
  "applicationId": "APP-1001",
  "amount": 25000,
  "status": "CREATED",
  "timestamp": 1737000000000
}
```

### 3.2 DecisionOverridden

```json
{
  "type": "DecisionOverridden",
  "applicationId": "APP-1001",
  "reason": "Manual risk override due to updated payroll verification",
  "newStatus": "OVERRIDDEN",
  "timestamp": 1737000012345
}
```

### 3.3 AIVersionRegistered

```json
{
  "type": "AIVersionRegistered",
  "modelId": "EMBED-SENTIMENT",
  "version": "1.2.0",
  "repoUrl": "https://github.com/acme-ml/sentiment-models",
  "artifactHash": "sha256:1f2d3a4b...789abcd",
  "description": "Transformer-based multilingual sentiment embeddings, retrained Sept 2025.",
  "timestamp": 1737000023456
}
```

### 3.4 AIVersionEvaluated

```json
{
  "type": "AIVersionEvaluated",
  "modelId": "EMBED-SENTIMENT",
  "version": "1.2.0",
  "evalId": "EVAL-2025-09-15-A",
  "dataset": "sentiment-benchmark-v3",
  "metrics": { "accuracy": 0.912, "f1": 0.887, "latency_ms_p95": 42.5 },
  "passed": true,
  "notes": "Meets production threshold for accuracy & latency.",
  "timestamp": 1737000034567
}
```

## 4. Submission Pipeline

1. Client sends REST POST → backend.
2. Backend constructs event object.
3. Backend executes `TopicMessageSubmitTransaction` with serialized JSON.
4. Hedera network:
   - Reaches consensus
   - Assigns consensus timestamp
   - Mirrors message to Mirror Nodes
5. Frontend polls Mirror Node:
   - `GET /api/v1/topics/{topicId}/messages`
   - Decodes base64 `message` → JSON
   - Renders in table

## 5. Consensus vs Local Timestamp

| Field                                       | Source              | Purpose                                      |
| ------------------------------------------- | ------------------- | -------------------------------------------- |
| `timestamp` (in event JSON)                 | Backend system time | Human-friendly reference (non-authoritative) |
| `consensus_timestamp` (Mirror Node wrapper) | Hedera network      | Immutable ordering & final reference         |

**Consumer Guidance**: Always trust `consensus_timestamp` for ordering / SLA calculations.

## 6. Integrity & Trust Model

| Threat                          | Mitigation (Current)           | Future Enhancement                |
| ------------------------------- | ------------------------------ | --------------------------------- |
| Event deletion                  | Impossible (immutable topic)   | —                                 |
| Local DB tampering claim        | Public Mirror Node cross-check | Add cryptographic signatures      |
| Reordering                      | Consensus timestamps           | Hash chain / Merkle proofs        |
| Forged origin (imposter server) | (Not addressed)                | ED25519 signature per event       |
| Metric falsification ex post    | Public immutable prior event   | Signed evaluation pipeline export |

## 7. Operational Concerns

| Aspect         | Current Approach                | Notes                                     |
| -------------- | ------------------------------- | ----------------------------------------- |
| Throughput     | Lightweight, sporadic events    | For high volume, batch or compress        |
| Cost           | Testnet (free) / mainnet low    | Each event small; cost scales with volume |
| Latency        | Seconds to consensus visibility | Poll interval can be tuned                |
| Monitoring     | Manual logs                     | Add metrics on submission results         |
| Error Handling | Simple 400/500 responses        | Could add retry & dead-letter strategy    |

## 8. Extension Blueprint

| Feature             | Implementation Sketch                                        |
| ------------------- | ------------------------------------------------------------ |
| Signatures          | Add `signature`, `publicKey`; sign canonical JSON pre-submit |
| Hash Chain          | Maintain `prevHash`; verify in UI                            |
| Replay Service      | Stream messages, fold into derived state snapshot            |
| Role-Based Access   | JWT to authorize event emission categories                   |
| Confidential Data   | Publish `hash(plaintext)`; store plaintext off-ledger        |
| Search/Filtering UI | Index Mirror Node results in a lightweight cache             |

## 9. Scaling Patterns

| Pattern                  | Use Case             | Description                                   |
| ------------------------ | -------------------- | --------------------------------------------- |
| Multi-Topic Segmentation | High throughput      | Partition by event domain (app vs AI)         |
| Aggregation Layer        | Analytics dashboards | Periodically consume Mirror Node into OLAP DB |
| Event Envelope           | Schema evolution     | `{ schemaVersion, payload, meta }` structure  |
| Compression              | Large metrics sets   | Compress JSON → base64 → HCS message          |

## 10. Testing Strategy

| Test                   | Purpose                                          |
| ---------------------- | ------------------------------------------------ |
| cURL Integration       | Verify each endpoint emits valid event           |
| Mirror Node Fetch      | Ensure external visibility                       |
| Order Verification     | Confirm consensus ordering matches expected flow |
| Adversarial (optional) | Attempt to “remove” event (should fail)          |
| Performance (optional) | Burst 100+ events; observe latency               |

## 11. Limitations

- No backfill or migration tool (starting fresh topic is simplest reset).
- No pagination UI (Mirror Node supports; UI can extend).
- No strong origin authentication (depends on deployment trust).
- In-memory override guard (lost on restart; acceptable for demo).

## 12. Upgrade Path Example (Signatures)

1. Define canonical serialization (sorted keys).
2. Sign with operator or dedicated service key.
3. Attach `signature` + `publicKey` to event JSON.
4. Frontend verifies using WebCrypto.

## 13. Example Mirror Node Record (Wrapped)

Mirror Node response snippet:

```json
{
  "messages": [
    {
      "chunk_info": null,
      "consensus_timestamp": "1757951203.123456789",
      "message": "eyJ0eXBlIjoiQXBwbGljYXRpb25DcmVhdGVkIiwiYXBwbGljYXRpb25JZCI6IkFQUC0xMDAxIiwiYW1vdW50IjoyNTAwMCwic3RhdHVzIjoiQ1JFQVRFRCIsInRpbWVzdGFtcCI6MTc1Nzk1MTIwMzQ1Nn0=",
      "running_hash": "...",
      "running_hash_version": 3,
      "sequence_number": 1,
      "topic_id": "0.0.1234567"
    }
  ]
}
```

Decoded `message` is the raw event JSON.

## 14. Compliance & Audit Commentary

- Provides authoritative ordering for audit narratives (“Override happened after creation at <consensus_timestamp>”).
- Can satisfy evidence requirements for model governance frameworks (e.g., emerging AI compliance guidelines) by making version registration & evaluation non-repudiable.

## 15. Summary

This architecture converts business and AI governance events into durable, independently verifiable records with minimal infrastructure. Hedera HCS acts as a **trust anchor**; the rest of the system remains intentionally lightweight and replaceable.
