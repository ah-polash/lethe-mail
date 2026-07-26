import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getActiveFreemiusCreds, listProducts } from "@/lib/freemius";

// GET: products (plugins) from the active Freemius account. Consumed by the
// Email Sequence editor so authors can reference product names in emails.
export async function GET() {
  try {
    await requireAuth();

    const creds = await getActiveFreemiusCreds();
    if (!creds) {
      return NextResponse.json(
        { products: [], error: "No active Freemius configuration. Add one in Settings → Freemius." },
        { status: 200 }
      );
    }

    const products = await listProducts(creds);
    return NextResponse.json({ products });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load products";
    if (message === "Unauthorized") return NextResponse.json({ error: message }, { status: 401 });
    return NextResponse.json({ products: [], error: message }, { status: 200 });
  }
}
