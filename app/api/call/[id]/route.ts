import { NextRequest, NextResponse } from "next/server";

const BASE = process.env.CALLE_BASE_URL || "https://api.heycall-e.com";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const apiKey = process.env.CALLE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing CALLE_API_KEY on server." }, { status: 500 });
  }

  const { id } = await context.params;

  const resp = await fetch(`${BASE}/v1/calls/${encodeURIComponent(id)}`, {
    headers: {
      "Authorization": `Bearer ${apiKey}`
    },
    cache: "no-store"
  });

  const data = await resp.json();

  if (!resp.ok) {
    return NextResponse.json(
      { error: data?.message || data?.error || "CALL-E status request failed", details: data },
      { status: resp.status }
    );
  }

  return NextResponse.json(data);
}
