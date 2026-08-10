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

## Q2 — 2026-08-10 — OPEN (page silent on IRS)

> "Although there may be a VAT exemption if the turnover is under €15,000, for
> IRS (income tax) purposes this amount will always have to be declared. This
> will result in an extra cost for the photographer at the end of the year,
> which will likely force many to increase the price of each session."

**He is right on the distinction and the page never makes it.** The whole `vat*`
block talks only about IVA and the art. 53.º threshold; a reader can easily come
away thinking "under €15k = nothing to pay". IVA exemption and IRS are unrelated.

**Where he is wrong, and it matters:** this is not an extra cost created by the
change. The income was always category B income and always declarable. What
changed is that it is now documented, not that it became taxable.

**The point in our favour, which nobody has told them yet:** under model B the
photographer invoices their **payout**, not the package price. Under *regime
simplificado* expenses are not deductible — so invoicing €255 instead of
invoicing €300 and paying us €45 leaves them with a materially smaller taxable
base. Our structure is the lighter of the two options for them, and the page
should say so.

**Fixed:** added `irsNote` to `invoicing.{pt,es,it}` (all 6 locales), rendered
under the VAT block — states that the exemption is about VAT only, that income
is declared regardless, and that they invoice the payout rather than the gross.
Deliberately no numbers and no advice; first-year activity reliefs and
coefficients are a contabilista question.

---

## Q3 — 2026-08-10 (Tatiana) — PARTLY FIXED

> "I would need the complete infos from each client — complete name / NIF /
> address. And of course they don't have a NIF as they are not from Portugal.
> I have never tried to do a fatura-recibo without completing the NIF info.
> I don't even know if it's possible to do it."
>
> "Who pays us is Stripe, therefore PhotoPortugal. It would make much more
> sense to do a factura recibo for the company PhotoPortugal."

**NIF half — still OPEN (usability, not liability).** The answer exists: pick
the client's country, use consumidor final `999999990`, and below €1000 to a
private individual the NIF is not required at all. But step 4 states this in one
line without showing the screen, and someone who has never done it cannot find
the field. Needs the actual Portal das Finanças screens, or a "we'll do the
first one with you on a call" offer.

**"Invoice Photo Portugal instead" — answered, no page change needed yet.** The
payment channel is not the buyer: the client buys the shoot, we introduce,
collect and hold. Terms §15, unchanged. The argument that actually lands is
self-interested, not authoritarian: invoicing a business triggers 25% retenção
na fonte under art. 101.º CIRS, recoverable only at the annual IRS settlement —
invoicing a private client has no withholding at all. Also note she assumed
"Portuguese company"; it is an ENI, not a company. Consider adding a short
"why not invoice the platform" FAQ block to the page if it comes up a third time.

**Also confirms Q1.** Her instinct that a fatura-recibo "doesn't make sense for
the clients" is the same timing problem: she has not been paid when the document
is due. The instruction was softened on 2026-08-10 (see below) but the
substantive answer still needs the contabilista.

---

## Safety pass — 2026-08-10

Applied after Q1-Q3, without waiting for the accountant, because all three are
about *genre* rather than tax substance:

- `s3deadline` now gives the **trigger** (the shoot day, explicitly not the
  payout day) and calls the number a general rule to confirm. A trigger is a
  fact we own; a deadline is a legal conclusion we do not.
- `s3p3` (PT) no longer asserts "choose Fatura-Recibo, the client has already
  paid". It lays out both documents and sends the choice to their contabilista.
  Removing a false claim needs no sign-off; replacing it with a different claim
  would.
- The "what we do not do" block moved **above** the steps, with a new
  `limitsIntro`: this page explains how, not what is right for you.
- Terms §4 `taxes` now covers guidance we publish: general information about how
  the platform works, not tax advice.

Rejected: showing shoot/payout dates on each booking (Alex — photographers
already know their own dates).

---

## Q4 — (next question goes here)
