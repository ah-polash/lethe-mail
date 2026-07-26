// Pure merge-tag helpers shared by the client editor and the server send path.
// No imports — safe to use in both a "use client" component and a route handler.

// Resolve a dot-path like "objects.user.email" (numeric segments index arrays).
export function getByPath(obj: unknown, path: string): unknown {
  if (!path) return undefined;
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const part of parts) {
    if (cur === null || cur === undefined) return undefined;
    if (typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

function stringifyValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  if (typeof v === "object") {
    try {
      return JSON.stringify(v);
    } catch {
      return "";
    }
  }
  return String(v);
}

// Replace {{path}} tokens (dot-paths allowed) with values from `data`.
export function resolveMergeTags(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{([\w.]+)\}\}/g, (_match, key: string) => {
    // Prefer an exact flat key first (handles keys that literally contain dots),
    // then fall back to nested dot-path lookup.
    const flat = Object.prototype.hasOwnProperty.call(data, key)
      ? (data as Record<string, unknown>)[key]
      : getByPath(data, key);
    return stringifyValue(flat);
  });
}

export interface FlatKey {
  path: string;
  value: string; // display-safe stringified leaf value
}

// Flatten an object into leaf dot-paths, e.g. { objects: { user: { email } } }
// -> [{ path: "objects.user.email", value: "..." }]. Arrays index by number.
export function flattenKeys(obj: unknown, prefix = "", out: FlatKey[] = []): FlatKey[] {
  if (obj === null || obj === undefined) {
    if (prefix) out.push({ path: prefix, value: "" });
    return out;
  }
  if (typeof obj !== "object") {
    if (prefix) out.push({ path: prefix, value: stringifyValue(obj) });
    return out;
  }
  const entries = Array.isArray(obj)
    ? obj.map((v, i) => [String(i), v] as const)
    : Object.entries(obj as Record<string, unknown>);

  if (entries.length === 0 && prefix) {
    out.push({ path: prefix, value: Array.isArray(obj) ? "[]" : "{}" });
    return out;
  }
  for (const [k, v] of entries) {
    const path = prefix ? `${prefix}.${k}` : k;
    flattenKeys(v, path, out);
  }
  return out;
}
