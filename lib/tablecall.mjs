const E164 = /^\+[1-9]\d{7,14}$/;

export function validateRequest(body) {
  if (!body || body.mode !== "claim_review") return "Choose a valid claim review request.";
  if (!body.provider?.trim() || !body.claimantName?.trim() || !body.claimQuestion?.trim()) return "Provider, your name, and your question are required.";
  if (body.phone && !E164.test(body.phone)) return "Use an E.164 phone number, for example +33612345678.";
  return null;
}

export function maskPhone(phone) {
  return `${phone.slice(0, 3)}••••••${phone.slice(-2)}`;
}

export function mockResult(body) {
  return {
    id: `mock_${crypto.randomUUID()}`, status: "completed", task_completed: true,
    structured_result: { outcome: "needs_user_action", claim_status: "review_needed", amount_at_issue: body.amount || "Not provided", deadline: "2026-10-12", reference_number: "784221", documents_requested: ["Itemized provider bill"], notes: `The insurer explained that this claim needs a review. They need an itemized bill from ${body.provider} before re-adjudication. No changes were made to the claim.`, next_steps: ["Request the itemized bill from the provider", "Upload it to ClaimBridge", "Ask for review before the deadline"] },
    transcript: "The claim was processed. We need an itemized bill from the provider before a review. The deadline is October 12, and the call reference number is 784221."
  };
}
