# Quick cURL Command Set (End-to-End Demo)

Assumes server running at `http://localhost:3000`.

## 0. Environment Helper

```bash
BASE=http://localhost:3000
```

## 1. Health & Topic

```bash
curl -s $BASE/health | jq
curl -s $BASE/api/topic | jq
```

Capture the `topicId` as `TOPIC_ID` if you want Mirror Node queries.

## 2. Create Application

```bash
curl -s -X POST $BASE/api/application \
  -H "Content-Type: application/json" \
  -d '{"applicationId":"APP-1001","amount":25000}' | jq
```

## 3. Override Decision

```bash
curl -s -X POST $BASE/api/override \
  -H "Content-Type: application/json" \
  -d '{"applicationId":"APP-1001","reason":"Manual risk override due to updated payroll verification"}' | jq
```

## 4. Register AI Model Version

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

## 5. Log Positive Evaluation

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

## 6. Log Negative Evaluation (Optional)

```bash
curl -s -X POST $BASE/api/ai/eval \
  -H "Content-Type: application/json" \
  -d '{
    "modelId":"EMBED-SENTIMENT",
    "version":"1.2.0",
    "evalId":"EVAL-2025-09-15-B",
    "dataset":"edge-case-noise-v1",
    "metrics":{"accuracy":0.602,"f1":0.560,"latency_ms_p95":65.4},
    "passed":false,
    "notes":"Fails on noisy informal text set."
  }' | jq
```

## 7. Query Mirror Node (Replace With Actual Topic)

```bash
TOPIC_ID=0.0.1234567
curl -s "https://testnet.mirrornode.hedera.com/api/v1/topics/$TOPIC_ID/messages?order=asc&limit=50" | jq
```

## 8. Decode Base64 Payloads

```bash
curl -s "https://testnet.mirrornode.hedera.com/api/v1/topics/$TOPIC_ID/messages?order=asc&limit=50" \
 | jq -r '.messages[].message' \
 | while read b64; do echo "$b64" | base64 --decode; echo; done
```

## 9. One-Liner Extract Types & Timestamps

```bash
curl -s "https://testnet.mirrornode.hedera.com/api/v1/topics/$TOPIC_ID/messages?order=asc&limit=50" \
 | jq -r '.messages[] | [.consensus_timestamp, ( ( .message | @base64d | fromjson ).type )] | @tsv'
```

## 10. Cleanup Notes

No deletion of events is possible (immutable). If you need a “fresh” history, start the server without `TOPIC_ID` to create a new topic.

---

## TL;DR Sequence

1. Create application
2. Override decision
3. Register model version
4. Log evaluation(s)
5. Query Mirror Node → prove transparency
