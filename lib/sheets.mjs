const syncedCalls = new Set();

function text(value, fallback = "", maxLength = 1000) {
  if (value === undefined || value === null) return fallback;
  return String(value).slice(0, maxLength);
}

function pickPriority(result) {
  const outcome = result?.outcome || result?.structured_result?.outcome;
  const deadline = result?.deadline || result?.structured_result?.deadline;
  if (outcome === "needs_user_action" && deadline) return "High";
  if (outcome === "needs_user_action") return "Medium";
  if (outcome === "failed") return "High";
  return "Low";
}

function summarize(result) {
  const structured = result?.structured_result || result || {};
  return structured.notes || structured.claim_status || result?.post_summary || result?.summary || "Call completed. Human review recommended.";
}

function transcript(result) {
  if (result?.transcript) return result.transcript;
  if (result?.post_transcript) return result.post_transcript;
  const turns = result?.recipients?.flatMap((recipient) =>
    recipient?.attempts?.flatMap((attempt) => attempt?.transcript_turns || []) || []
  ) || [];
  if (!turns.length) return summarize(result);
  return turns.map((turn) => `${turn.speaker || "speaker"}: ${turn.text || ""}`).join("\n");
}

function confidence(result) {
  const score = result?.completion_confidence?.score;
  const label = result?.completion_confidence?.label;
  if (label && score !== undefined) return `${label} ${score}`;
  if (label) return label;
  if (score !== undefined) return String(score);
  return "Needs human review";
}

function nextAction(result) {
  const structured = result?.structured_result || result || {};
  if (Array.isArray(structured.next_steps) && structured.next_steps.length) return structured.next_steps.join("; ");
  if (structured.outcome === "resolved") return "No immediate action required.";
  return "Review call result and decide next action.";
}

export function buildSheetRow({ requestBody = {}, callResult = {} }) {
  const structured = callResult?.structured_result || {};
  const metadata = callResult?.metadata || {};
  const callId = callResult?.id || callResult?.call_id || callResult?.run_id || requestBody.id || "";

  return {
    call_id: text(callId),
    date: new Date().toISOString(),
    customer_name: text(requestBody.recipientName || metadata.recipientName || requestBody.claimantName || metadata.claimantName),
    masked_phone: text(requestBody.maskedPhone || metadata.maskedPhone),
    category: text(metadata.category || requestBody.mode || "claim_review"),
    summary: text(summarize(callResult)),
    transcript: text(transcript(callResult), summarize(callResult), 8000),
    priority: pickPriority(callResult),
    deadline: text(structured.deadline || callResult?.deadline),
    required_action: text(nextAction(callResult)),
    owner: "",
    status: text(callResult?.status || structured.outcome || "completed"),
    confidence: text(callResult?.confidence || confidence(callResult)),
    human_review_required: structured.outcome === "resolved" ? "No" : "Yes"
  };
}

export async function appendSheetRow(row) {
  const url = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  const token = process.env.GOOGLE_SHEETS_SYNC_TOKEN;
  if (!url || !token || !row?.call_id) return { configured: Boolean(url && token), skipped: true };
  if (syncedCalls.has(row.call_id)) return { configured: true, skipped: true, duplicate: true };

  const endpoint = new URL(url);
  endpoint.searchParams.set("token", token);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ row })
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(message || `Google Sheets sync failed with ${response.status}`);
  }

  syncedCalls.add(row.call_id);
  return { configured: true, synced: true };
}

export async function syncSheetRow(input) {
  const row = buildSheetRow(input);
  try {
    return await appendSheetRow(row);
  } catch (error) {
    return { configured: true, synced: false, error: error instanceof Error ? error.message : "Google Sheets sync failed" };
  }
}
