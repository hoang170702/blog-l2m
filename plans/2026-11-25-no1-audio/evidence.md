# Evidence

## Planning Evidence

- 2026-11-25 12:50 +07 (machine B): research written to context.md from the current `main` (c32cf3a) and platform knowledge of the Web Speech API, MediaRecorder and Supabase Storage. No external calls made. Steering from the user: "nghiên cứu chức năng audio nhé, tạo plan sẵn đi, chiều 1h tôi vào là làm thôi, không cần hỏi lại tôi" — the plan is drafted without asking; Q1 is the one choice the user should confirm when they start (it decides whether Storage is touched at all).

## Approval

- 2026-11-25 13:05 +07: user chose "Web Speech API đi, lấy giọng của máy, khỏi chọn" after a comparison of TTS services (regional voices only on paid Vietnamese APIs; free tiers too small). D1, D3 accepted; D2, D4 dropped; Q1 closed. Status: Approved.

## Amendments

None at approval.

## Execution Log

None yet.

## Handoff Notes

- Workflow to copy from R4: one `feature/*` branch per phase, `--no-ff` merge into `main`, full check set after each merge, push `main` + branches to Gitea as hoang170702 (one-off credential helper, never store the token).
- Helper scripts used in R4 lived in `/tmp` on machine B and are not in the repo; the check set is: root `npm run db:test:embedded`; `frontend/`: `npm run typecheck && npm run lint && npm test && npm run build`.
