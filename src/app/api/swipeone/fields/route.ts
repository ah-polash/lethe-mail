import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getContactFields } from "@/lib/swipeone";

interface RawField {
  name?: string;
  key?: string;
  id?: string;
  label?: string;
  title?: string;
  displayName?: string;
  type?: string;
}

function normalize(raw: unknown): { name: string; label: string; type?: string }[] {
  // Response could be { data: { fields: [...] } } | { fields: [...] } | [...]
  let list: RawField[] = [];
  if (Array.isArray(raw)) {
    list = raw as RawField[];
  } else if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const data = (obj.data as Record<string, unknown>) ?? obj;
    if (Array.isArray(data)) {
      list = data as RawField[];
    } else if (Array.isArray((data as Record<string, unknown>)?.fields)) {
      list = (data as { fields: RawField[] }).fields;
    } else if (Array.isArray((data as Record<string, unknown>)?.contactFields)) {
      list = (data as { contactFields: RawField[] }).contactFields;
    }
  }

  return list
    .map((f) => {
      const name = f.name || f.key || f.id || "";
      const label = f.label || f.title || f.displayName || name;
      return { name: String(name), label: String(label), type: f.type };
    })
    .filter((f) => f.name);
}

export async function GET() {
  try {
    await requireAuth();
    const raw = await getContactFields();
    const fields = normalize(raw);
    return NextResponse.json({ fields });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
