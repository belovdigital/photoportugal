# Invoicing — questions photographers actually asked

Running log. Every question here is a hole in `/dashboard/invoicing`
(`messages/*.json` → `invoicing.{pt,es,it}`) until it is closed there.
Add the question the day it arrives, even before the answer is settled —
the pattern of what people ask is the roadmap for the page.

Status: **OPEN** = page still does not answer it · **ANSWERED** = page covers it
· **⚠️ CONTRADICTS PAGE** = the page currently says something we now believe is
wrong.

---

## Q1 — 2026-08-10 — ⚠️ CONTRADICTS PAGE

> "We issue recibo after the shoot is done, even if we receive money in a week,
> do we?"

**Why it matters:** on this platform the client pays at booking, but the
photographer's payout only lands after the client accepts the delivery (or
after the 14-day auto-release). Shoot day and money day are routinely one to
three weeks apart. The photographer is asking which of those two dates starts
the clock.

**The mechanics (to be confirmed by the contabilista, NOT settled by us):**

- A **fatura** documents the *service*. Portuguese rule of thumb: within 5
  working days of the service being rendered — i.e. counted from the shoot.
- A **recibo** documents the *payment*. It follows the money.
- A **fatura-recibo** is both in one document, and it presupposes that the
  money has already been received.

**The page is currently wrong on this.** `invoicing.pt.s3p3` tells the
photographer to choose *Fatura-Recibo* because "the client has already paid" —
but the client paying US is not the photographer receiving money. At the moment
the fatura is due (shoot + 5 working days), the photographer has usually not
been paid yet, so a fatura-recibo would certify a payment that has not happened.

**Likely correct instruction** (needs sign-off): issue a **fatura** within 5
working days of the shoot, then a **recibo** when the payout arrives. Where the
payout happens to land before the fatura is due, a single **fatura-recibo** is
fine.

**Blocked on:** contabilista confirmation. Do not ship a tax-substance change
to this instruction without it — being confidently wrong twice is worse than
being late once.

---

## Q2 — (next question goes here)
