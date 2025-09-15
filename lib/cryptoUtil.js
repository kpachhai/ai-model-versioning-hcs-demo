import crypto from "crypto";

/**
 * Deterministically stringify with sorted keys (shallow).
 * For deeply nested objects, you could implement a recursive sort.
 */
export function canonicalize(obj) {
  if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
  const sorted = {};
  Object.keys(obj)
    .sort()
    .forEach((k) => {
      const v = obj[k];
      if (v && typeof v === "object" && !Array.isArray(v)) {
        // shallow demo; deeper structures could be recursively handled
        const inner = {};
        Object.keys(v)
          .sort()
          .forEach((ik) => (inner[ik] = v[ik]));
        sorted[k] = inner;
      } else {
        sorted[k] = v;
      }
    });
  return JSON.stringify(sorted);
}

export function sha256Hex(str) {
  return "sha256:" + crypto.createHash("sha256").update(str).digest("hex");
}

/**
 * Compute event hash (exclude prevHash field).
 */
export function computeEventHash(eventObj) {
  const clone = { ...eventObj };
  delete clone.prevHash;
  const canon = canonicalize(clone);
  return sha256Hex(canon);
}
