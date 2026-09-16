---
status: accepted
---

# A card's 点数 is its maximum-performance expected parameter gain under an all-SP-lesson reference route

The 凸別点数一覧 needs one number per (card, 凸) that players can compare. We define a point as one parameter (Vo+Da+Vi summed) the card is expected to add over one run of the target scenario, computed as effect value × the number of times the route profile says that trigger occurs, with every conditional trigger (stat ≥ N, cards ≥ N, stamina ratio) treated as always satisfied, and with the route assuming every lesson taken is an SP lesson (so SPレッスン発生率+ effects score 0 and 通常レッスン-only effects score 0). Card events and card-granted P-items count once and trigger-limit times respectively. Alternatives rejected: hand-tuned ability weights (opinion, unexplainable), full produce simulation (needs an engine per scenario, slow to keep current), fulfilment ratios for conditional triggers (more knobs, and the community's de facto standard is maximum performance).

Source: user decisions D1, D4, D10, D11, D12 in the grill-me session of 2026-09-16 (`docs/plans/EXECPLAN_SUPPORT_CARD_SCORE_TABLE.md` § Decision Log). Not yet validated against community-published numbers; validation is milestone M2 of that plan.
