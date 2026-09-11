# ClaimBridge user journey

## 1. User starts a claim brief

The user enters a plain-language problem:

> My emergency claim was denied. I want to know why and what documents are needed for review.

The app collects only the provider, provider phone, user name, service date, amount, optional claim reference, and language.

## 2. The app shows the call plan

Before dialing, the user sees:

- The destination number
- The purpose of the call
- The information shared
- The questions the agent will ask
- What the agent will do if identity verification is requested

The user clicks **Approve and start call**.

## 3. Greeting

The agent begins with a clear disclosure:

> Hello, I am an AI assistant calling on behalf of Maya. I am calling to ask about one insurance claim. I will not provide passwords, verification codes, payment details, or other secrets.

## 4. IVR navigation

The agent listens to the menu and chooses only a clearly matching option.

Example:

```text
IVR: For claims, press 1. For billing, press 2. For benefits, press 3.
Agent: [presses 1]

IVR: For an existing claim, press 1. To start a new claim, press 2.
Agent: [presses 1]
```

If the menu is unclear, the agent does not guess. It stops and returns `needs_user_action`.

## 5. Representative conversation

```text
Agent: Can you tell me the current status of the claim?
Representative: It was denied because supporting documents are missing.

Agent: Which documents are needed for review?
Representative: An itemized provider bill and the visit summary.

Agent: What is the review deadline?
Representative: October 12.

Agent: May I have the reference number for this call?
Representative: 784221.

Agent: Thank you. I am an AI assistant, and I will report this information to the user.
```

The agent listens after every response, updates the task state, and asks the next approved question. It does not follow a fixed list blindly if the representative already answered a later question.

## 6. Safety interruption

```text
Representative: Please provide the one-time code sent to your phone.
Agent: I cannot handle security codes. The user must complete verification manually. Goodbye.
```

The call ends with `needs_user_action`; the app never asks the user to type the code into ClaimBridge.

## 7. Structured result

```json
{
  "outcome": "needs_user_action",
  "claim_status": "review_needed",
  "documents_requested": ["Itemized provider bill", "Visit summary"],
  "deadline": "2026-10-12",
  "reference_number": "784221",
  "next_steps": [
    "Request the itemized bill from the provider",
    "Upload the visit summary",
    "Ask for review before October 12"
  ],
  "confidence": "high"
}
```

The result screen separates facts captured from the call, the transcript, and the user’s next steps. Unknown fields remain `unknown` or `null`.

## 8. Retry journey

If nobody answers, the app shows **Retry now**, **Retry later**, and **Finish**. The agent never redials automatically.
