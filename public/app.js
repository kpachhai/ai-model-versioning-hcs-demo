const state = {
  topicId: null,
  events: [],
  lastConsensus: null
};

function log(msg) {
  const el = document.getElementById("log");
  const line = document.createElement("div");
  line.textContent = `[${new Date().toISOString()}] ${msg}`;
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
}

async function init() {
  await fetchTopic();
  startPolling();
  wireAppForms();
  wireModelForms();
}

async function fetchTopic() {
  const r = await fetch("/api/topic");
  const j = await r.json();
  state.topicId = j.topicId;
  document.getElementById("topicDisplay").textContent = state.topicId;
  log(`Using topic ${state.topicId}`);
}

function startPolling() {
  fetchNew();
  setInterval(fetchNew, 4000);
}

async function fetchNew() {
  if (!state.topicId) return;
  let url = `https://testnet.mirrornode.hedera.com/api/v1/topics/${state.topicId}/messages?order=asc&limit=25`;
  if (state.lastConsensus) {
    url += `&timestamp=gt:${state.lastConsensus}`;
  }
  try {
    const r = await fetch(url);
    if (!r.ok) {
      log(`Mirror poll failed status ${r.status}`);
      return;
    }
    const j = await r.json();
    if (!j.messages || !j.messages.length) {
      log("Poll: no new messages");
      return;
    }
    let added = 0;
    j.messages.forEach((m) => {
      if (!state.events.find((e) => e._consensus === m.consensus_timestamp)) {
        state.lastConsensus = m.consensus_timestamp;
        try {
          const decoded = atob(m.message);
          const evt = JSON.parse(decoded);
          evt._consensus = m.consensus_timestamp;
          state.events.push(evt);
          added++;
        } catch (e) {
          log(`Parse error: ${e.message}`);
        }
      }
    });
    if (added > 0) {
      log(`Poll: added ${added} new event(s)`);
      renderEvents();
    } else {
      log("Poll: 0 added (duplicates filtered)");
    }
  } catch (e) {
    log(`Poll exception: ${e.message}`);
  }
}

function renderEvents() {
  const tbody = document.getElementById("eventsBody");
  tbody.innerHTML = "";
  state.events.forEach((evt, i) => {
    const tr = document.createElement("tr");
    const { primary, secondary, detail } = deriveColumns(evt);
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${evt._consensus || ""}</td>
      <td>${evt.type}</td>
      <td>${primary}</td>
      <td>${secondary}</td>
      <td>${detail}</td>
    `;
    tbody.appendChild(tr);
  });
}

function deriveColumns(evt) {
  switch (evt.type) {
    case "ApplicationCreated":
      return {
        primary: evt.applicationId || "",
        secondary: evt.amount != null ? evt.amount : "",
        detail: evt.status || ""
      };
    case "DecisionOverridden":
      return {
        primary: evt.applicationId || "",
        secondary: evt.newStatus || "",
        detail: evt.reason || ""
      };
    case "AIVersionRegistered":
      return {
        primary: evt.modelId || "",
        secondary: evt.version || "",
        detail: `${(evt.artifactHash || "").slice(0, 20)}… ${evt.repoUrl || ""}`
      };
    case "AIVersionEvaluated":
      const metrics = evt.metrics || {};
      const metricPairs = Object.keys(metrics)
        .slice(0, 2)
        .map((k) => `${k}=${metrics[k]}`);
      return {
        primary: evt.modelId || "",
        secondary: evt.version || "",
        detail: `${metricPairs.join(", ")} ${evt.passed ? "[PASSED]" : ""} ${
          evt.dataset || ""
        }`
      };
    default:
      return { primary: "", secondary: "", detail: "" };
  }
}

function setStatus(id, msg, isErr = false) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.className = "status " + (isErr ? "err" : "ok");
}

function wireAppForms() {
  document.getElementById("createBtn").addEventListener("click", async () => {
    const applicationId = document.getElementById("appId").value.trim();
    const amount = document.getElementById("amount").value.trim();
    if (!applicationId || !amount) {
      return setStatus("createStatus", "Provide applicationId & amount", true);
    }
    setStatus("createStatus", "Submitting...");
    const r = await fetch("/api/application", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applicationId, amount })
    });
    const j = await r.json();
    if (j.error) return setStatus("createStatus", j.error, true);
    setStatus("createStatus", "Created (will appear after poll)");
    log(`Created event local: ${j.type} ${j.applicationId}`);
  });

  document.getElementById("overrideBtn").addEventListener("click", async () => {
    const applicationId = document.getElementById("ovrAppId").value.trim();
    const reason = document.getElementById("ovrReason").value.trim();
    if (!applicationId || !reason) {
      return setStatus(
        "overrideStatus",
        "Provide applicationId & reason",
        true
      );
    }
    setStatus("overrideStatus", "Submitting...");
    const r = await fetch("/api/override", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applicationId, reason })
    });
    const j = await r.json();
    if (j.error) return setStatus("overrideStatus", j.error, true);
    setStatus("overrideStatus", "Override logged");
    log(`Override event local: ${j.type} ${j.applicationId}`);
  });
}

function wireModelForms() {
  document.getElementById("regModelBtn").addEventListener("click", async () => {
    const modelId = document.getElementById("modelId").value.trim();
    const version = document.getElementById("modelVersion").value.trim();
    const repoUrl = document.getElementById("repoUrl").value.trim();
    const artifactHash = document.getElementById("artifactHash").value.trim();
    const description = document.getElementById("modelDesc").value.trim();
    if (!modelId || !version || !repoUrl || !artifactHash) {
      return setStatus(
        "modelStatus",
        "modelId, version, repoUrl, artifactHash required",
        true
      );
    }
    setStatus("modelStatus", "Submitting...");
    const r = await fetch("/api/ai/version", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        modelId,
        version,
        repoUrl,
        artifactHash,
        description
      })
    });
    const j = await r.json();
    if (j.error) return setStatus("modelStatus", j.error, true);
    setStatus("modelStatus", "Version registered");
    log(`AI Version registered: ${j.modelId} v${j.version}`);
  });

  document.getElementById("logEvalBtn").addEventListener("click", async () => {
    const modelId = document.getElementById("evalModelId").value.trim();
    const version = document.getElementById("evalVersion").value.trim();
    const evalId = document.getElementById("evalId").value.trim();
    const dataset = document.getElementById("dataset").value.trim();
    const metricsRaw = document.getElementById("metrics").value.trim();
    const passed = document.getElementById("passed").checked;
    const notes = document.getElementById("notes").value.trim();

    if (!modelId || !version || !evalId || !dataset || !metricsRaw) {
      return setStatus(
        "evalStatus",
        "modelId, version, evalId, dataset, metrics required",
        true
      );
    }
    let metrics;
    try {
      metrics = JSON.parse(metricsRaw);
    } catch (e) {
      return setStatus("evalStatus", "metrics must be valid JSON", true);
    }
    setStatus("evalStatus", "Submitting...");
    const r = await fetch("/api/ai/eval", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        modelId,
        version,
        evalId,
        dataset,
        metrics,
        passed,
        notes
      })
    });
    const j = await r.json();
    if (j.error) return setStatus("evalStatus", j.error, true);
    setStatus("evalStatus", "Evaluation logged");
    log(`AI Evaluation logged: ${j.modelId} v${j.version} eval=${j.evalId}`);
  });
}

window.addEventListener("load", init);
