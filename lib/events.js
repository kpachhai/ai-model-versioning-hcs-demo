import { TopicMessageSubmitTransaction } from "@hashgraph/sdk";

// Simple in-memory state for applications
const applications = {}; // applicationId -> status

// ----- Helper to publish -----
async function submitEvent(client, topicId, eventObj) {
  const tx = await new TopicMessageSubmitTransaction()
    .setTopicId(topicId)
    .setMessage(JSON.stringify(eventObj))
    .execute(client);
  await tx.getReceipt(client);
  return eventObj;
}

// ----- Application Events -----
export async function createApplication({
  client,
  topicId,
  applicationId,
  amount
}) {
  const evt = {
    type: "ApplicationCreated",
    applicationId,
    amount,
    status: "CREATED",
    timestamp: Date.now()
  };
  const stored = await submitEvent(client, topicId, evt);
  applications[applicationId] = "CREATED";
  return stored;
}

export async function overrideDecision({
  client,
  topicId,
  applicationId,
  reason
}) {
  if (!applications[applicationId]) {
    throw new Error("Unknown application");
  }
  // We allow one override only for demo
  if (applications[applicationId] === "OVERRIDDEN") {
    throw new Error("Already overridden");
  }
  const evt = {
    type: "DecisionOverridden",
    applicationId,
    reason,
    newStatus: "OVERRIDDEN",
    timestamp: Date.now()
  };
  const stored = await submitEvent(client, topicId, evt);
  applications[applicationId] = "OVERRIDDEN";
  return stored;
}

// ----- AI Versioning Events -----
export async function registerAIVersion({
  client,
  topicId,
  modelId,
  version,
  repoUrl,
  artifactHash,
  description
}) {
  const evt = {
    type: "AIVersionRegistered",
    modelId,
    version,
    repoUrl,
    artifactHash,
    description,
    timestamp: Date.now()
  };
  return submitEvent(client, topicId, evt);
}

export async function logAIEvaluation({
  client,
  topicId,
  modelId,
  version,
  evalId,
  dataset,
  metrics,
  passed,
  notes
}) {
  // metrics expected to be an object (e.g. {accuracy:0.912, f1:0.88})
  if (typeof metrics !== "object" || Array.isArray(metrics)) {
    throw new Error("metrics must be an object");
  }
  const evt = {
    type: "AIVersionEvaluated",
    modelId,
    version,
    evalId,
    dataset,
    metrics,
    passed,
    notes,
    timestamp: Date.now()
  };
  return submitEvent(client, topicId, evt);
}
