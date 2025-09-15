import dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { Client, TopicCreateTransaction, PrivateKey } from "@hashgraph/sdk";
import {
  createApplication,
  overrideDecision,
  registerAIVersion,
  logAIEvaluation
} from "./lib/events.js";

console.log(
  "[BOOT]",
  new Date().toISOString(),
  "PID",
  process.pid,
  "Loading server.js"
);

const { OPERATOR_ID, OPERATOR_KEY, TOPIC_ID, PORT = 3000 } = process.env;

if (!OPERATOR_ID || !OPERATOR_KEY) {
  console.error("[ENV] OPERATOR_ID:", OPERATOR_ID);
  console.error("[ENV] OPERATOR_KEY present?:", !!OPERATOR_KEY);
  throw new Error("Missing OPERATOR_ID or OPERATOR_KEY in environment (.env).");
}

const priv = PrivateKey.fromStringECDSA(OPERATOR_KEY.trim());
const client = Client.forTestnet().setOperator(OPERATOR_ID.trim(), priv);

let topicId = TOPIC_ID && TOPIC_ID.trim().length ? TOPIC_ID.trim() : null;

async function ensureTopic() {
  if (topicId) {
    console.log("[Hedera] Using existing topic:", topicId);
    return;
  }
  console.log("[Hedera]", new Date().toISOString(), "Creating new topic...");
  const txResp = await new TopicCreateTransaction().execute(client);
  const receipt = await txResp.getReceipt(client);
  topicId = receipt.topicId.toString();
  console.log("[Hedera] Created topic:", topicId);
}
await ensureTopic();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (_req, res) => res.json({ ok: true, topicId }));
app.get("/api/topic", (_req, res) => res.json({ topicId }));

// Application creation
app.post("/api/application", async (req, res) => {
  try {
    const { applicationId, amount } = req.body || {};
    if (!applicationId || amount == null) {
      return res.status(400).json({ error: "applicationId & amount required" });
    }
    const evt = await createApplication({
      client,
      topicId,
      applicationId: applicationId.trim(),
      amount: Number(amount)
    });
    res.json(evt);
  } catch (err) {
    console.error("[Create Application Error]", err);
    res.status(500).json({ error: err.message });
  }
});

// Decision override
app.post("/api/override", async (req, res) => {
  try {
    const { applicationId, reason } = req.body || {};
    if (!applicationId || !reason) {
      return res.status(400).json({ error: "applicationId & reason required" });
    }
    const evt = await overrideDecision({
      client,
      topicId,
      applicationId: applicationId.trim(),
      reason: reason.trim()
    });
    res.json(evt);
  } catch (err) {
    console.error("[Override Error]", err);
    res.status(400).json({ error: err.message });
  }
});

// AI Version registration
app.post("/api/ai/version", async (req, res) => {
  try {
    const { modelId, version, repoUrl, artifactHash, description } =
      req.body || {};
    if (!modelId || !version || !repoUrl || !artifactHash) {
      return res
        .status(400)
        .json({ error: "modelId, version, repoUrl, artifactHash required" });
    }
    const evt = await registerAIVersion({
      client,
      topicId,
      modelId: modelId.trim(),
      version: version.trim(),
      repoUrl: repoUrl.trim(),
      artifactHash: artifactHash.trim(),
      description: (description || "").trim()
    });
    res.json(evt);
  } catch (err) {
    console.error("[AI Version Error]", err);
    res.status(400).json({ error: err.message });
  }
});

// AI Evaluation logging
app.post("/api/ai/eval", async (req, res) => {
  try {
    const { modelId, version, evalId, dataset, metrics, passed, notes } =
      req.body || {};
    if (!modelId || !version || !evalId || !dataset || !metrics) {
      return res
        .status(400)
        .json({ error: "modelId, version, evalId, dataset, metrics required" });
    }
    const evt = await logAIEvaluation({
      client,
      topicId,
      modelId: modelId.trim(),
      version: version.trim(),
      evalId: evalId.trim(),
      dataset: dataset.trim(),
      metrics,
      passed: !!passed,
      notes: (notes || "").trim()
    });
    res.json(evt);
  } catch (err) {
    console.error("[AI Eval Error]", err);
    res.status(400).json({ error: err.message });
  }
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`[Server] Listening on http://localhost:${PORT}`);
  console.log("[Server] Topic ID:", topicId);
  console.log("[Server] Operator ID:", OPERATOR_ID);
});
