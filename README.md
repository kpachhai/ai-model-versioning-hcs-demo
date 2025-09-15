# Hedera Decision & AI Version Ledger (Minimal Demo)

A minimal demonstration of using **Hedera Consensus Service (HCS)** as an immutable, publicly verifiable event ledger for:

- Financial application lifecycle events (creation + manual override)
- AI / ML model governance (model version registration + evaluation logging)

> Goal: Show how critical operational and AI provenance events can be recorded as append-only, timestamped facts on Hedera, enabling independent verification and stronger audit/compliance posture.

---

## Contents

- [Features](#features)
- [Architecture Overview](#architecture-overview)
- [Event Types](#event-types)
- [API Endpoints](#api-endpoints)
- [Quick Start](#quick-start)
- [Example cURL Workflow](#example-curl-workflow)
- [Demo Walkthrough Script](#demo-walkthrough-script)
- [Design Notes & Extensibility](#design-notes--extensibility)
- [License](#license)

---

## Features

| Feature               | Description                                                            |
| --------------------- | ---------------------------------------------------------------------- |
| Immutable Events      | Each business or AI governance action is a Hedera consensus message    |
| Public Auditability   | Anyone with the topic ID can query Mirror Nodes to reconstruct history |
| Ordered Timeline      | Consensus timestamps establish definitive event order                  |
| Governance Visibility | Manual overrides become explicit, permanent entries                    |
| AI Provenance         | Model artifact hash + evaluation metrics recorded immutably            |
| Simple Frontend       | Polls Mirror Node (no backend DB dependency for event feed)            |

---

## Architecture Overview

```
User ---> REST POST ---> Backend (Node.js) ---> Hedera Consensus Service
                                                   |
                                            Mirror Node (Public)
                                                   |
                                   Frontend Poll (HTTPS JSON) <--- Browser
```

1. Backend creates (or reuses) a Hedera Topic at startup.
2. Endpoints accept JSON payloads; each event is serialized and submitted via `TopicMessageSubmitTransaction`.
3. Frontend periodically polls a Mirror Node for new messages and renders them.
4. No mutable state is required to “prove” history—raw events are externally queryable.

---

## Event Types

| Type                | Purpose                                       | Key Fields                                                             |
| ------------------- | --------------------------------------------- | ---------------------------------------------------------------------- |
| ApplicationCreated  | Start an application lifecycle                | applicationId, amount, status=CREATED, timestamp                       |
| DecisionOverridden  | Human/manual governance action                | applicationId, reason, newStatus=OVERRIDDEN, timestamp                 |
| AIVersionRegistered | Attest a model version + artifact fingerprint | modelId, version, repoUrl, artifactHash, description, timestamp        |
| AIVersionEvaluated  | Log evaluation metrics snapshot               | modelId, version, evalId, dataset, metrics{}, passed, notes, timestamp |

> NOTE: No hash chaining or signatures in the minimal build. Those can be layered on.

---

## API Endpoints

| Method | Path             | Body                                                           | Description              |
| ------ | ---------------- | -------------------------------------------------------------- | ------------------------ |
| GET    | /health          | -                                                              | Liveness + topicId       |
| GET    | /api/topic       | -                                                              | Returns current topicId  |
| POST   | /api/application | {applicationId, amount}                                        | Create application event |
| POST   | /api/override    | {applicationId, reason}                                        | Manual override          |
| POST   | /api/ai/version  | {modelId, version, repoUrl, artifactHash, description?}        | Register model version   |
| POST   | /api/ai/eval     | {modelId, version, evalId, dataset, metrics{}, passed, notes?} | Log evaluation           |

All responses return the event JSON echoed back.

---

## Quick Start

### Prerequisites

- Node 18+ (or later)
- A Hedera **Testnet** account (for OPERATOR_ID / OPERATOR_KEY)

### Environment

Create `.env`:

Request test hbar on your testnet account at [https://portal.hedera.com/dashboard](https://portal.hedera.com/dashboard)

```
OPERATOR_ID=0.0.xxxxxx
OPERATOR_KEY=0xe151420c... (Ecdsa hex encoded private key string)
# Optional: reuse a topic(or leave it blank to create a new topic)
# TOPIC_ID=0.0.yyyyyyy
PORT=3000
```

### Install & Run

```bash
npm install
npm start
```

Terminal output:

```
[Hedera] Created topic: 0.0.1234567
[Server] Listening on http://localhost:3000
```

### Open Frontend

Visit: http://localhost:3000

---

## Example cURL Workflow

Set base:

```bash
BASE=http://localhost:3000
```

1. Health & Topic

```bash
curl -s $BASE/health | jq
curl -s $BASE/api/topic | jq
```

2. Create Application

```bash
curl -s -X POST $BASE/api/application \
  -H "Content-Type: application/json" \
  -d '{"applicationId":"APP-1001","amount":25000}' | jq
```

3. Override

```bash
curl -s -X POST $BASE/api/override \
  -H "Content-Type: application/json" \
  -d '{"applicationId":"APP-1001","reason":"Manual risk override due to updated payroll verification"}' | jq
```

4. Register AI Version

```bash
curl -s -X POST $BASE/api/ai/version \
  -H "Content-Type: application/json" \
  -d '{
    "modelId":"EMBED-SENTIMENT",
    "version":"1.2.0",
    "repoUrl":"https://github.com/acme-ml/sentiment-models",
    "artifactHash":"sha256:1f2d3a4b5c6d7e8f90123456789abcdef0123456789abcdef0123456789abcd",
    "description":"Transformer-based multilingual sentiment embeddings, retrained Sept 2025."
  }' | jq
```

5. Log Evaluation

```bash
curl -s -X POST $BASE/api/ai/eval \
  -H "Content-Type: application/json" \
  -d '{
    "modelId":"EMBED-SENTIMENT",
    "version":"1.2.0",
    "evalId":"EVAL-2025-09-15-A",
    "dataset":"sentiment-benchmark-v3",
    "metrics":{"accuracy":0.912,"f1":0.887,"latency_ms_p95":42.5},
    "passed":true,
    "notes":"Meets production threshold for accuracy & latency."
  }' | jq
```

6. Mirror Node Raw Messages (replace TOPIC_ID):

```bash
TOPIC_ID=0.0.1234567
curl -s "https://testnet.mirrornode.hedera.com/api/v1/topics/$TOPIC_ID/messages?order=asc&limit=50" | jq
```

7. Decode Base64 payloads:

```bash
curl -s "https://testnet.mirrornode.hedera.com/api/v1/topics/$TOPIC_ID/messages?order=asc&limit=50" \
 | jq -r '.messages[].message' \
 | while read b64; do echo "$b64" | base64 --decode; echo; done
```

---

## Design Notes & Extensibility

| Enhancement                                            | Benefit                                            |
| ------------------------------------------------------ | -------------------------------------------------- |
| Digital Signatures                                     | Prove origin authenticity (who emitted event)      |
| Hash Chain                                             | Detect reordering / omission locally               |
| Encryption / Selective Disclosure                      | Keep sensitive fields private while logging proofs |
| Additional Events (ModelDeprecated, RiskScoreComputed) | Richer governance narrative                        |
| Replay Tool                                            | Reconstruct point-in-time state deterministically  |

---

## License

MIT
