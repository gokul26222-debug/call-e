import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
// The helper is intentionally plain ESM so it can also be tested directly by Node.
// @ts-expect-error JavaScript module has no generated declaration file.
import { maskPhone, mockResult, validateRequest } from "../../../lib/tablecall.mjs";

const BASE = process.env.CALLE_BASE_URL || "https://api.heycall-e.com";
const activeRequests = new Map<string, string>();

function schema(mode: string) {
  return { type: "object", required: ["outcome", "claim_status", "notes", "next_steps"], properties: { outcome: { type: "string", enum: ["needs_user_action", "resolved", "failed", "unknown"] }, claim_status: { type: "string" }, amount_at_issue: { type: "string" }, deadline: { type: "string" }, reference_number: { type: "string" }, documents_requested: { type: "array", items: { type: "string" } }, notes: { type: "string" }, next_steps: { type: "array", items: { type: "string" } } }, additionalProperties: false };
}

function buildTask(b: Record<string, string>) {
  return `Call ${b.provider} on behalf of ${b.claimantName}. Clearly disclose that you are an AI assistant. Ask only for claim status, a plain-language explanation of the issue, documents needed, review or appeal deadline, and a reference number. Never request or repeat SSN, passwords, OTPs, full member IDs, payment details, or medical diagnoses. If identity verification or consent is required, stop and return needs_user_action. Claim context: ${b.claimQuestion}. Amount: ${b.amount || "not provided"}. Service date: ${b.serviceDate || "not provided"}.`;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const invalid = validateRequest(body);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });
  if (process.env.MOCK_MODE !== "false") return NextResponse.json(mockResult(body));
  if (process.env.ALLOW_REAL_CALLS !== "true") return NextResponse.json({ error: "Real calling is disabled. Keep mock mode on, or explicitly set ALLOW_REAL_CALLS=true for an authorized test." }, { status: 403 });
  if (!process.env.CALLE_API_KEY) return NextResponse.json({ error: "Missing CALLE_API_KEY on the server." }, { status: 500 });
  if (body.realCallConfirmed !== true) return NextResponse.json({ needs_confirmation: true, provider: body.provider, phone: maskPhone(body.phone), purpose: `Ask ${body.provider} about claim status, denial reason, required documents, deadline, and reference number.` });

  const fingerprint = crypto.createHash("sha256").update(JSON.stringify({ mode: body.mode, phone: body.phone, customer: body.claimantName, details: [body.provider, body.claimQuestion, body.amount, body.serviceDate] })).digest("hex");
  if (activeRequests.has(fingerprint)) return NextResponse.json({ error: "An identical live request is already active. Check its existing call status instead." }, { status: 409 });
  const idempotencyKey = `tablecall_${fingerprint}`;
  activeRequests.set(fingerprint, idempotencyKey);
  try {
    const response = await fetch(`${BASE}/v1/calls`, { method: "POST", headers: { Authorization: `Bearer ${process.env.CALLE_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey }, body: JSON.stringify({ task: buildTask(body), recipients: [{ phones: [body.phone], locale: "en-US" }], result_schema: schema(body.mode), metadata: { product: "claimbridge", mode: body.mode } }) });
    const data = await response.json();
    if (!response.ok) return NextResponse.json({ error: data?.message || data?.error || "CALL-E could not start the call." }, { status: response.status });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Could not reach CALL-E. No confirmation of a call was received; retry only after checking your dashboard." }, { status: 502 });
  } finally {
    activeRequests.delete(fingerprint);
  }
}
