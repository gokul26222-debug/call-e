import { NextRequest, NextResponse } from "next/server";
// @ts-expect-error JavaScript module has no generated declaration file.
import { syncSheetRow } from "../../../../lib/sheets.mjs";

const BASE = process.env.CALLE_BASE_URL || "https://api.heycall-e.com";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const secret = process.env.CLAIMBRIDGE_API_SECRET;
  if (!secret || req.headers.get("x-claimbridge-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const apiKey = process.env.CALLE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing CALLE_API_KEY on server." }, { status: 500 });
  }

  const { id } = await context.params;

  if (id.startsWith("mock_")) return NextResponse.json({ id, status: "completed", structured_result: { outcome: "needs_user_action" } });
  try {
    const resp = await fetch(`${BASE}/v1/calls/${encodeURIComponent(id)}`, {
      headers: { "Authorization": `Bearer ${apiKey}` }, cache: "no-store"
    });
    const text = await resp.text();
    let data: any = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text.slice(0, 500) }; }

    if (!resp.ok) {
    return NextResponse.json(
      { error: data?.message || data?.error || "CALL-E status request failed", details: data },
      { status: resp.status }
    );
    }

    const isTerminal = ["completed", "failed", "ended"].includes(String(data?.status || "").toLowerCase()) || data?.task_completed === true;
    if (isTerminal) {
      const sheet_sync = await syncSheetRow({ callResult: data });
      return NextResponse.json({ ...data, sheet_sync });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Could not reach CALL-E while checking status." }, { status: 502 });
  }
}
