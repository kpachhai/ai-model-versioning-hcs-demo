import {
  Client,
  PrivateKey,
  TopicCreateTransaction,
  TopicMessageSubmitTransaction
} from "@hashgraph/sdk";

let client;
let topicId;

export async function initHedera({ operatorId, operatorKey, existingTopicId }) {
  const priv = PrivateKey.fromStringECDSA(operatorKey);
  client = Client.forTestnet().setOperator(operatorId, priv);

  if (existingTopicId && existingTopicId.trim() !== "") {
    topicId = existingTopicId.trim();
    console.log("[Hedera] Using existing topic:", topicId);
  } else {
    console.log("[Hedera] Creating new topic...");
    const tx = await new TopicCreateTransaction().execute(client);
    const receipt = await tx.getReceipt(client);
    topicId = receipt.topicId.toString();
    console.log("[Hedera] Created topic:", topicId);
  }
  return topicId;
}

export function getTopicId() {
  return topicId;
}

export async function publishMessage(messageStr) {
  if (!client || !topicId) throw new Error("Client or topicId not initialized");
  const submit = await new TopicMessageSubmitTransaction()
    .setTopicId(topicId)
    .setMessage(Buffer.from(messageStr))
    .execute(client);
  const receipt = await submit.getReceipt(client);
  return {
    sequenceNumber: receipt.topicSequenceNumber?.toNumber
      ? receipt.topicSequenceNumber.toNumber()
      : receipt.topicSequenceNumber
  };
}
