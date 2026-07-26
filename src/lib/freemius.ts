import crypto from "node:crypto";
import https from "node:https";
import { prisma } from "@/lib/db";

// Freemius developer-scope REST client.
//
// Auth mirrors the official Freemius PHP SDK (freemius/FreemiusBase.php +
// Freemius.php GenerateAuthorizationParams):
//   string_to_sign = METHOD \n CONTENT-MD5 \n CONTENT-TYPE \n DATE \n RESOURCE
//   signature      = base64url( HEX( HMAC_SHA256(string_to_sign, secretKey) ) )
//                    ^ note: PHP hash_hmac() defaults to hex output, and that
//                      hex STRING is then base64-encoded — not the raw digest.
//   Authorization: FS {developerId}:{publicKey}:{signature}
// GET requests have empty Content-MD5 and Content-Type.

const API_HOST = "api.freemius.com";

export interface FreemiusCreds {
  developerId: string;
  publicKey: string;
  secretKey: string;
}

export interface FreemiusProduct {
  id: string;
  title: string;
  slug: string;
}

function base64Url(input: string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// PHP date('r') — RFC 2822, e.g. "Sat, 14 Feb 2015 20:24:46 +0000".
function rfc2822(d: Date): string {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const p = (n: number) => String(n).padStart(2, "0");
  return `${days[d.getUTCDay()]}, ${p(d.getUTCDate())} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()} ${p(
    d.getUTCHours()
  )}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} +0000`;
}

// Developer-scope resource path, e.g. "plugins.json" -> /v1/developers/{id}/plugins.json
function canonize(developerId: string, path: string): string {
  const clean = path.replace(/^\/+|\/+$/g, "");
  return `/v1/developers/${developerId}/${clean}`;
}

export function signRequest(
  creds: FreemiusCreds,
  method: string,
  resource: string,
  date: string,
  contentMd5 = "",
  contentType = ""
): string {
  const stringToSign = [method.toUpperCase(), contentMd5, contentType, date, resource].join("\n");
  const hex = crypto.createHmac("sha256", creds.secretKey).update(stringToSign).digest("hex");
  const signature = base64Url(hex);
  const authType = creds.secretKey !== creds.publicKey ? "FS" : "FSP";
  return `${authType} ${creds.developerId}:${creds.publicKey}:${signature}`;
}

function httpsGetJson(
  path: string,
  headers: Record<string, string>
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { host: API_HOST, path, method: "GET", headers },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve({ status: res.statusCode || 0, body: data }));
      }
    );
    req.on("error", reject);
    req.end();
  });
}

// GET a developer-scope resource and return the parsed JSON (or throw with the
// Freemius error message).
async function freemiusGet(creds: FreemiusCreds, path: string): Promise<unknown> {
  const resource = canonize(creds.developerId, path);
  const date = rfc2822(new Date());
  const authorization = signRequest(creds, "GET", resource, date);

  const { status, body } = await httpsGetJson(resource, {
    Accept: "application/json",
    Date: date,
    Authorization: authorization,
  });

  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    throw new Error(`Freemius returned non-JSON (HTTP ${status})`);
  }
  if (status < 200 || status >= 300) {
    const err = (json as { error?: { message?: string } })?.error?.message;
    throw new Error(err || `Freemius API error (HTTP ${status})`);
  }
  return json;
}

// List all products (plugins) for the developer account.
export async function listProducts(creds: FreemiusCreds): Promise<FreemiusProduct[]> {
  const json = (await freemiusGet(creds, "plugins.json")) as { plugins?: Array<Record<string, unknown>> };
  const plugins = Array.isArray(json.plugins) ? json.plugins : [];
  return plugins.map((p) => ({
    id: String(p.id ?? ""),
    title: String(p.title ?? p.slug ?? "Untitled"),
    slug: String(p.slug ?? ""),
  }));
}

// Resolve the active Freemius config from the DB (null if none).
export async function getActiveFreemiusCreds(): Promise<FreemiusCreds | null> {
  const cfg = await prisma.freemiusConfig.findFirst({ where: { isActive: true } });
  if (!cfg) return null;
  return { developerId: cfg.developerId, publicKey: cfg.publicKey, secretKey: cfg.secretKey };
}
