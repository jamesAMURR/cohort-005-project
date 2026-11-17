# Cadence

Cadence is a course marketplace: instructors publish courses, and learners buy and work through them.

## Language

### People

**Learner**:
A person who buys and takes courses.
_Avoid_: Student

### Pricing

**Regional Price**:
A course price reduced according to the Learner's country, using a fixed set of discount tiers. A purchase made at a Regional Price is tied to that location.
_Avoid_: PPP price, purchasing power price

### Refunds

**Refund Request**:
A Learner's ask for their money back on one specific purchase, with their reason. A person reviews it, and it ends up Approved or Declined. A purchase can have several Refund Requests over time, but only one open at once. Support may raise one on a Learner's behalf.
_Avoid_: Cancellation, Reversal, Chargeback, pending refund

**Refund**:
The return of the Refund Amount that an Approved Refund Request commits to. It exists from approval onward. Every Refund comes from exactly one Approved Refund Request, and a Declined request produces none.
_Avoid_: Reversal, Chargeback, Cancellation

**Refund Amount**:
The money a Refund gives back: exactly what the Learner paid for the purchase.
_Avoid_: Refundable amount

**Refund Period**:
The 14 calendar days after a purchase during which a Learner may raise a Refund Request.
_Avoid_: Refund window, cancellation window

**Refund Deadline**:
The last day of the Refund Period, as a UTC date.

**Refund Eligibility**:
Whether a Learner may raise a Refund Request on a purchase right now. They must be inside the Refund Period, under the watch-time and completion limits, have no claimed team seat on the purchase, and have no Refund Request already open.
