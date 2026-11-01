# BAKE N TAKE — PHASE 4

## Cart, Ordering, COD Checkout, Order Management & Notification System

## ROLE

Continue working as a senior/staff-level:

- Full-stack engineer
- Backend architect
- Frontend engineer
- PostgreSQL/Supabase architect
- Commerce/order-system architect
- Security engineer
- UI/UX designer
- QA engineer
- DevOps engineer
- Distributed-systems engineer
- Technical documentation engineer

Phase 1 — Authentication  
Phase 2 — Store Settings  
Phase 3 — Product & Category Management

are already completed and must be treated as stable foundations.

**Do not break or unnecessarily refactor previous phases.**

This is a major phase. Work carefully and incrementally.

---

# 1. PHASE 4 OBJECTIVE

Build the complete first version of the bakery's commerce and order-management system.

The complete flow must be:

```text
Customer
  ↓
Browse Products
  ↓
Select Product
  ↓
Select Variant / Size / Quantity
  ↓
Select Flavours / Customizations
  ↓
Optional Custom Design Upload
  ↓
┌───────────────────────┐
│ Save to Cart           │
│ OR                     │
│ Order Now              │
└───────────────────────┘
          ↓
      Order Review
          ↓
Customer Details
          ↓
Payment Method
          ↓
Cash on Delivery
          ↓
Confirm & Place Order
          ↓
Order Created
          ↓
┌───────────────────────┐
│ Customer Notification  │
│ Owner Notification     │
└───────────────────────┘
          ↓
Owner Orders Dashboard
          ↓
Order Status Management
          ↓
Baking
          ↓
Ready for Pickup
          ↓
Completed
          ↓
Customer receives notification at every status change
```

The system must be production-grade, secure, transactional, scalable and ready for future online payments.

---

# 2. IMPORTANT SCOPE

Implement:

- Customer cart
- Product configuration
- Order Now
- Order review
- Customer details
- COD checkout
- Order creation
- Order number
- Order status system
- Owner Orders page
- Order status updates
- Customer order history
- Order details
- In-app notifications
- Notification center
- Unread notification count
- Real-time notification updates
- Order status notifications
- Order cancellation foundation where appropriate
- Order data integrity
- Immutable order snapshots
- Audit/event history
- Proper authorization
- Testing
- Documentation

Do NOT implement online payment processing yet.

Do NOT integrate:

- Razorpay
- Stripe
- PayPal
- UPI gateway
- Card processing
- Payment webhooks

However, architect the payment model so online payments can be introduced later without redesigning the order system.

---

# 3. FIRST STEP — FULL CODEBASE AUDIT

Before implementation:

Inspect the entire existing repository.

Understand:

- Authentication
- Customer/owner roles
- Store Settings
- Product architecture
- Product variants
- Product flavours
- Product customization
- Product image storage
- Customer design uploads
- Existing data-access patterns
- RLS
- Supabase Storage
- Existing notification infrastructure if any
- Existing UI system
- Existing caching/revalidation
- Testing
- CI/CD
- Documentation

Do not start coding immediately.

First understand the existing architecture and identify where Phase 4 should integrate.

---

# 4. REMOVE / REPLACE ANY ORDERING MOCKS

Search the entire application for:

- Dummy cart data
- Mock orders
- Fake order statuses
- Static cart counts
- Fake notification counts
- Placeholder order pages
- Demo checkout logic
- Hardcoded order numbers
- Mock customer details

Remove production-facing mock behavior.

The production application must use Supabase-backed data.

---

# 5. NOTIFICATION ICON

Add a notification icon to the navigation/header for BOTH:

### Customer

Customer navigation should include:

- Notification bell
- Unread count/badge
- Notification dropdown or panel

### Owner

Owner navigation should include:

- Notification bell
- Unread count/badge
- Notification dropdown or panel

Use the existing design system and Lucide icons.

Do not create a completely separate visual language.

---

# 6. NOTIFICATION CENTER

Create a proper notification system.

Notifications must be persisted in Supabase.

Do NOT rely exclusively on temporary browser state.

A notification should contain at minimum:

- ID
- Recipient user ID
- Notification type
- Title
- Message
- Related entity type
- Related entity ID
- Read/unread state
- Created timestamp
- Read timestamp where applicable

The architecture should support future notification types.

---

# 7. NOTIFICATION TYPES

Create a typed notification system.

Examples:

### Customer

`ORDER_PLACED`

"Your order #BNK-XXXX has been placed successfully."

`ORDER_CONFIRMED`

"Your order has been confirmed."

`ORDER_BAKING`

"Your order is now being prepared."

`ORDER_READY`

"Your order is ready for pickup."

`ORDER_COMPLETED`

"Your order has been completed. Thank you for ordering from Bake n Take!"

`ORDER_CANCELLED`

"Your order has been cancelled."

### Owner

`NEW_ORDER`

"New order #BNK-XXXX received."

`ORDER_CANCELLED`

"Order #BNK-XXXX was cancelled."

Keep notification types extensible.

---

# 8. REAL-TIME NOTIFICATIONS

Use an appropriate server-backed real-time architecture.

For this Supabase-based application:

Prefer:

**Supabase Realtime + persisted notifications**

rather than relying on browser-only events.

When an order is placed:

1. Create the order.
2. Create the relevant notification records.
3. Commit the transaction successfully.
4. Realtime delivers the notification to connected users.
5. Offline users still see the notification when they return.

Do not make notification delivery the thing that determines whether an order was successfully created.

---

# 9. WEBHOOK DECISION

Do NOT use an external webhook as the primary internal notification mechanism.

For internal customer/owner notifications:

```text
Database Event
      ↓
Order/Event Logic
      ↓
Persist Notification
      ↓
Supabase Realtime
      ↓
Customer / Owner UI
```

Use webhooks/server functions later for external integrations such as:

- Email
- WhatsApp
- SMS
- Payment gateways
- Third-party systems

The internal order system must not depend on those external services.

---

# 10. CART SYSTEM

Create a persistent customer cart.

Each authenticated customer should have one active cart.

The cart must support:

- Multiple products
- Multiple quantities
- Different product configurations
- Different variants
- Different flavours
- Customization options
- Custom design references where applicable

Do not store the cart only in localStorage.

Use Supabase as the authoritative persistent cart.

You may optionally use local UI state for responsiveness, but the backend remains authoritative.

---

# 11. CART ITEM CONFIGURATION

A cart item represents a specific product configuration.

For example:

```text
Chocolate Truffle Cake
2 Pound
Ferrero Flavour
Custom Design: Yes
Quantity: 1
```

Another cart item could be:

```text
Chocolate Truffle Cake
1 Pound
Chocolate Flavour
Quantity: 2
```

These must be treated as separate configurations when appropriate.

---

# 12. CART ITEM CUSTOMIZATION SNAPSHOT

Do not rely solely on the current product configuration when displaying a historical cart/order.

Store the selected configuration appropriately.

The cart item should retain:

- Product reference
- Product name snapshot where appropriate
- Selected variant
- Selected flavour
- Selected options
- Customization data
- Custom design reference
- Quantity
- Price snapshot

This protects the cart from unexpected product edits.

---

# 13. CART PRICE

The server must calculate authoritative cart pricing.

Do not trust a price sent by the browser.

The client may send:

- Product ID
- Variant ID
- Flavour ID
- Selected options
- Quantity

The server must retrieve authoritative product data and calculate:

```text
Variant/Base Price
+
Flavour Surcharge
+
Other Applicable Option Charges
=
Unit Configuration Price
```

Then:

```text
Unit Price × Quantity
=
Line Total
```

Do not use floating-point arithmetic for money.

Use the project's established integer-smallest-unit or decimal strategy consistently.

---

# 14. CART OPERATIONS

Support:

- Add item
- Update quantity
- Remove item
- Clear cart
- View cart
- Calculate subtotal

Prevent:

- Negative quantity
- Zero quantity
- Invalid product
- Inactive product
- Invalid variant
- Invalid flavour
- Invalid customization
- Unauthorized cart access

---

# 15. CART MERGING

If the application supports anonymous browsing, design the architecture so a future anonymous cart can be merged into the authenticated cart.

Do not implement anonymous cart functionality unless it fits naturally into the existing authentication architecture.

Authenticated customer carts are mandatory.

---

# 16. CART ICON

Add a cart icon to the customer navigation.

Display:

- Cart icon
- Item count

The count should represent the number of cart items or total units according to a clearly defined UX convention.

Choose one and keep it consistent.

---

# 17. ORDER NOW

On the product detail page provide:

### Save to Cart

Adds the configured product to the customer's persistent cart.

### Order Now

Does NOT necessarily need to create a cart record first.

It should take the customer into an order-review flow using the selected configuration.

However, avoid duplicating pricing logic.

Both paths must use the same server-side product configuration validation and pricing logic.

---

# 18. ORDER REVIEW PAGE

Create a professional order review page.

Display:

- Product image
- Product name
- Selected size/weight
- Selected quantity/batch
- Selected flavour
- Additional customization
- Custom design indicator
- Quantity
- Unit price
- Line total

Then show:

### Order Summary

- Subtotal
- Discounts placeholder for future phase
- Delivery/pickup charge placeholder if applicable
- Final total

Do not implement promotional discounts yet unless already required elsewhere.

---

# 19. CUSTOMER DETAILS

The order page must contain customer details.

Automatically prefill:

- Customer name
- Phone number
- Email

from the authenticated customer's profile/account data.

The customer must be able to edit the details for this order.

Do not silently overwrite the customer's saved profile just because they edited checkout details.

Distinguish between:

**Account Profile**

and

**Order Contact Snapshot**

---

# 20. ORDER CONTACT SNAPSHOT

When the order is placed, store the customer contact details used for that order.

This is critical.

Future profile changes must NOT change historical order contact information.

Store:

- Full name
- Phone
- Email
- Pickup/contact information as required

as an immutable order snapshot.

---

# 21. PAYMENT METHOD

Create a payment method selection interface.

For this phase:

### Cash on Delivery / Pay on Pickup

must be available.

Since this is a bakery pickup workflow, clearly communicate the actual payment timing/meaning rather than incorrectly implying home delivery.

Use appropriate wording such as:

**Pay at Pickup / Cash**

if that reflects the store's intended process.

Keep the database architecture ready for:

- Online
- UPI
- Card
- Razorpay
- Other gateways

in a future phase.

---

# 22. PAYMENT DATA MODEL

Create a proper payment representation.

At minimum support:

- Payment ID
- Order ID
- Method
- Status
- Amount
- Currency
- Created timestamp
- Updated timestamp

For this phase:

```text
method = COD / PAY_AT_PICKUP
status = PENDING
```

Do not pretend an online payment was completed.

---

# 23. ORDER CREATION

Order creation must be transactional.

The critical operation should conceptually be:

```text
Validate customer
      ↓
Validate products/configurations
      ↓
Calculate authoritative prices
      ↓
Create order
      ↓
Create order items
      ↓
Create payment record
      ↓
Create order event
      ↓
Create owner notification
      ↓
Create customer notification
      ↓
Commit
```

If a critical database operation fails:

**do not create a partially valid order.**

Use appropriate transaction mechanisms.

---

# 24. ORDER NUMBER

Generate a customer-friendly order number.

Example:

```text
BNK-20260925-0042
```

Do not expose raw database IDs as the primary customer-facing order identifier.

Order numbers must be unique.

Do not rely exclusively on timestamps for uniqueness.

---

# 25. ORDER SNAPSHOTS

This is extremely important.

An order must preserve what the customer actually ordered at the time of purchase.

Do not rely only on foreign keys to the current product data.

Store snapshots for:

- Product name
- Product description where appropriate
- Product image reference where appropriate
- Variant name
- Variant value
- Flavour name
- Customization selections
- Unit price
- Quantity
- Line total

If the owner later changes:

- Product name
- Price
- Flavour surcharge
- Variant price
- Product image

the historical order must remain unchanged.

---

# 26. ORDER STATUS MACHINE

Create an explicit order status system.

Recommended statuses:

```text
PENDING
CONFIRMED
BAKING
READY_FOR_PICKUP
COMPLETED
CANCELLED
```

Define valid transitions.

Example:

```text
PENDING
  ↓
CONFIRMED
  ↓
BAKING
  ↓
READY_FOR_PICKUP
  ↓
COMPLETED
```

Cancellation rules must be explicit.

Do not allow arbitrary status jumping from the frontend.

---

# 27. STATUS TRANSITION VALIDATION

The server must validate status transitions.

For example:

Do not allow:

```text
PENDING → COMPLETED
```

unless explicitly permitted.

Do not allow customers to change order status.

Only authorized owners should be able to update order processing status.

---

# 28. ORDER EVENT HISTORY

Create an order-event/history system.

Record:

- Order ID
- Previous status
- New status
- Actor/user ID
- Event type
- Timestamp
- Optional metadata

This provides a reliable audit trail.

Example:

```text
10:15 — Order placed
10:17 — Confirmed by owner
10:45 — Baking started
11:30 — Ready for pickup
12:05 — Completed
```

Do not rely only on the current `status` column.

---

# 29. OWNER ORDERS PAGE

Create:

**Owner Dashboard → Orders**

The owner should see:

- Order number
- Customer name
- Date/time
- Total
- Payment method
- Payment status
- Order status
- Item count

Support:

- Search by order number
- Search by customer
- Filter by status
- Filter by date
- Sort by newest/oldest

Keep the initial interface clean and fast.

---

# 30. OWNER ORDER DETAIL

Create a detailed order view.

Display:

### Customer

- Name
- Phone
- Email

### Order

- Order number
- Created date/time
- Status
- Payment method
- Payment status

### Items

- Product
- Variant
- Flavour
- Customization
- Custom design
- Quantity
- Unit price
- Total

### Order Summary

- Subtotal
- Final total

### Timeline

Show order status history.

---

# 31. OWNER STATUS CONTROLS

Owner should have appropriate controls such as:

```text
Confirm Order
Start Baking
Mark Ready for Pickup
Complete Order
Cancel Order
```

Only show actions that are valid for the current status.

Do not allow invalid transitions.

Require confirmation for destructive actions such as cancellation/completion where appropriate.

---

# 32. CUSTOMER ORDER HISTORY

Create:

**My Orders**

Customers should see:

- Order number
- Date
- Total
- Status
- Item summary

Clicking an order opens:

**Order Details**

---

# 33. CUSTOMER ORDER DETAIL

Display:

- Order number
- Current status
- Order timeline
- Items
- Customizations
- Quantity
- Prices
- Payment method
- Total
- Contact information snapshot

The customer must never see private owner-only information.

---

# 34. CUSTOMER ORDER TIMELINE

Create a visually clear timeline:

```text
✓ Order Placed
  ↓
✓ Confirmed
  ↓
● Baking
  ↓
○ Ready for Pickup
  ↓
○ Completed
```

The current status should be visually obvious.

Support cancellation state separately.

---

# 35. NOTIFICATION FLOW — NEW ORDER

When the customer successfully places an order:

Create:

### Customer notification

"Order #BNK-XXXX has been placed successfully."

### Owner notification

"New order #BNK-XXXX received."

Both notifications must be persisted.

Realtime should deliver them to currently connected clients.

---

# 36. NOTIFICATION FLOW — STATUS CHANGES

Whenever owner changes:

```text
CONFIRMED
BAKING
READY_FOR_PICKUP
COMPLETED
CANCELLED
```

create a customer notification.

Example:

### Baking

"Your order #BNK-XXXX is now being prepared."

### Ready

"Your order #BNK-XXXX is ready for pickup."

### Completed

"Your order #BNK-XXXX has been completed."

---

# 37. NOTIFICATION READ SYSTEM

Support:

- Mark individual notification read
- Mark all read
- Unread count
- Read timestamp

The unread count must remain accurate across page reloads.

---

# 38. REALTIME UX

If a customer is currently viewing the app and the owner changes the order status:

The customer should receive the notification without manually refreshing the page.

Similarly:

If the owner is logged in and a new order arrives:

The owner should see the new notification in real time.

Handle reconnection gracefully.

Do not duplicate notifications when the realtime connection reconnects.

---

# 39. IDEMPOTENCY

This is critical.

Prevent accidental duplicate orders caused by:

- Double-clicking Place Order
- Browser retries
- Network retries
- Repeated API requests

Implement an appropriate idempotency strategy.

A single customer submission must not accidentally create multiple orders.

---

# 40. CONCURRENCY

Handle cases where:

- Product becomes unavailable while customer is checking out.
- Product price changes during checkout.
- Variant becomes inactive.
- Flavour becomes inactive.
- Owner edits product while customer has it in cart.

The server must revalidate everything immediately before order creation.

Never trust stale client data.

---

# 41. PRODUCT AVAILABILITY DURING ORDER

At checkout/order creation:

Verify:

- Product is active
- Variant is active
- Flavour is active
- Selected customization is valid

If something changed:

Do not create the order.

Return a clear message asking the customer to review the affected item.

---

# 42. CUSTOM DESIGN HANDLING

If a product allows custom design:

The order should retain the selected design reference.

The design asset must become associated with the order once the order is created.

This is different from a temporary pre-order upload.

Design the storage/data model so:

```text
Temporary Design
      ↓
Order Created
      ↓
Order Design Asset
```

can be handled safely.

Do not leave customer-uploaded files permanently orphaned.

---

# 43. CUSTOM DESIGN PRIVACY

Customer design images may contain personal or copyrighted content.

Treat them as private order assets.

Customers should only be able to access their own relevant designs.

Owners should only access designs belonging to legitimate orders they are authorized to manage.

Do not make order design storage publicly writable.

---

# 44. CART CONSISTENCY

When an order is successfully created from the cart:

Clear the relevant purchased cart items.

Do not clear unrelated cart items.

If an order creation transaction fails:

Do not partially clear the cart.

---

# 45. ORDER NOW CONSISTENCY

If Order Now bypasses the cart:

Do not accidentally leave duplicate items in the cart unless explicitly intended.

Define and document the behavior.

Prefer a predictable UX.

---

# 46. CUSTOMER DETAILS VALIDATION

Validate:

- Name
- Phone
- Email

Server-side and client-side.

Prevent obviously invalid data.

Do not accept arbitrary excessively long strings.

---

# 47. SECURITY

Perform a serious security review.

Check for:

- IDOR
- Customer accessing another customer's order
- Customer modifying another customer's cart
- Customer changing order status
- Price manipulation
- Product configuration manipulation
- Payment status manipulation
- Notification access leaks
- Owner privilege escalation
- RLS bypass
- Unauthorized design-file access
- Mass assignment
- Duplicate order creation
- Replay attacks
- Unsafe input
- XSS

Never trust:

- User role from the browser
- Product price from the browser
- Order total from the browser
- Payment status from the browser
- Order status from the browser

---

# 48. RLS

Implement restrictive Supabase RLS.

### Customer

Can:

- Read own cart
- Modify own cart
- Create/read own orders through the intended secure flow
- Read own order items
- Read own notifications
- Mark own notifications read
- Read own order events where appropriate

Cannot:

- Read another customer's data
- Modify order status
- Modify payment status
- Modify another customer's cart
- Read owner notifications

### Owner

Can:

- Read/manage legitimate orders
- Update valid order statuses
- Read order items
- Read/manage owner notifications

Do not simply create broad authenticated-user policies.

---

# 49. SERVER ACTIONS / API

Use the existing project's established backend pattern.

Centralize sensitive mutations.

Examples:

- Add cart item
- Update cart
- Remove cart item
- Create order
- Update order status
- Mark notification read

Do not scatter business logic across client components.

---

# 50. BUSINESS LOGIC LAYER

Keep the architecture clean:

```text
UI
 ↓
Server/API
 ↓
Business Logic
 ↓
Data Access
 ↓
Supabase
```

Do not put authoritative:

- Price calculation
- Order creation
- Status transition
- Authorization

inside React components.

---

# 51. DATABASE TRANSACTIONS

Use transactional operations for critical order creation.

The order should never exist without its required:

- Order items
- Payment record
- Initial event
- Required notification/event state

Where notification delivery itself cannot be included transactionally, persist an event/outbox-style record first and process delivery from that durable record.

---

# 52. OUTBOX / EVENT ARCHITECTURE

Because this is the beginning of a larger commerce system, strongly prefer an event/outbox foundation.

Conceptually:

```text
Order Transaction
       ↓
Order Created
       ↓
Order Event / Outbox Record
       ↓
Notification Processing
       ↓
Notification Record
       ↓
Realtime
```

This prevents an order from being successfully created while its notification is silently lost.

Do not introduce unnecessary microservices.

A reliable modular monolith is preferred at this stage.

---

# 53. ORDER STATUS EVENTS

Create durable events for important transitions:

- ORDER_CREATED
- ORDER_CONFIRMED
- ORDER_BAKING
- ORDER_READY
- ORDER_COMPLETED
- ORDER_CANCELLED

Use these events to drive notification generation.

---

# 54. FUTURE PAYMENT READINESS

Although online payment is NOT implemented now:

Design the order/payment relationship so future integration can support:

```text
ORDER
 ↓
PAYMENT
 ↓
PAYMENT_PENDING
 ↓
PAYMENT_PROCESSING
 ↓
PAYMENT_SUCCESS
 /
PAYMENT_FAILED
```

Do not make COD-specific assumptions throughout the order architecture.

---

# 55. FUTURE OFFERS COMPATIBILITY

Phase 3 established products.

Future phases will introduce:

- BOGO
- Percentage discounts
- Mix & Match

Do not implement them now.

However, the order schema should eventually support:

- Subtotal
- Discount
- Discount breakdown
- Final total

without changing the fundamental order model.

For Phase 4, discount amount can remain zero.

---

# 56. ORDER TOTAL SNAPSHOT

When an order is created, persist the authoritative financial snapshot.

At minimum:

- Subtotal
- Discount
- Tax if applicable later
- Additional charges if applicable
- Grand total
- Currency

For this phase:

```text
discount = 0
```

unless another already implemented system requires otherwise.

---

# 57. PICKUP-ONLY CLARITY

This bakery currently uses customer pickup.

Make the checkout UX explicitly clear:

**This order is for pickup from the store.**

Display:

- Store address
- Pickup instructions
- Contact information

using the centralized Phase 2 Store Settings.

Do not create delivery functionality.

---

# 58. PICKUP DATE

If the existing product/store requirements already define customer-selected pickup dates, design the order model so pickup scheduling can be added cleanly.

If pickup-date selection is introduced in this phase, implement it carefully with:

- Date validation
- Store closed dates/hours consideration
- Appropriate timezone
- Future-date validation

Do not allow arbitrary past dates.

If the business has not yet defined pickup scheduling rules, do not invent complex scheduling logic.

Document the limitation.

---

# 59. CUSTOMER UX

The entire ordering flow should feel:

- Simple
- Premium
- Calm
- Trustworthy
- Mobile-first
- Fast
- Clear

The customer should always know:

1. What they selected.
2. How it is customized.
3. How much it costs.
4. Where they will pick it up.
5. How they are paying.
6. What happens after placing the order.

---

# 60. CHECKOUT UX

Use a clear progression:

```text
Review Order
     ↓
Your Details
     ↓
Payment
     ↓
Confirm Order
```

Do not create unnecessary multi-page complexity.

A single well-designed checkout/review page is acceptable if the UX remains clear.

---

# 61. ORDER CONFIRMATION PAGE

After successful order placement:

Show:

- Success state
- Order number
- Total
- Payment method
- Pickup location
- Current status
- Expected next step
- Link to Order Details
- Link to My Orders

Do not merely redirect to the homepage.

---

# 62. ERROR HANDLING

Handle:

- Product unavailable
- Invalid configuration
- Cart failure
- Checkout failure
- Database failure
- Notification failure
- Realtime disconnection
- Storage failure
- Session expiration
- Duplicate submission

Never expose raw Supabase/database errors to customers.

---

# 63. ACCESSIBILITY

Ensure:

- Keyboard navigation
- Accessible form labels
- Accessible dialogs
- Focus management
- Screen-reader-friendly notifications
- Accessible status indicators
- Proper button states
- Reduced-motion support

---

# 64. PERFORMANCE

Avoid:

- N+1 product queries
- N+1 cart queries
- Excessive realtime subscriptions
- Polling notifications every few seconds
- Recalculating expensive data unnecessarily

Use appropriate indexes.

Subscribe only to data relevant to the authenticated user.

---

# 65. NOTIFICATION SUBSCRIPTIONS

Do not subscribe a customer to every notification in the database.

Realtime subscriptions must be scoped to the authenticated user.

Likewise, owner notifications must not expose customer-specific private notifications to unrelated users.

---

# 66. TESTING

Create comprehensive tests.

### Cart

- Add item
- Update quantity
- Remove item
- Clear cart
- Multiple configurations
- Invalid product
- Invalid variant
- Invalid flavour
- Unauthorized access

### Checkout

- Customer data prefill
- Editable contact information
- Validation
- COD selection
- Review accuracy
- Price calculation

### Order creation

- Successful order
- Transaction failure
- Duplicate submission
- Price changes
- Product becoming unavailable
- Invalid configuration

### Orders

- Owner sees order
- Customer sees own order
- Customer cannot see another order
- Owner status transition
- Invalid transition rejected
- Order history preserved

### Notifications

- New order notification
- Status-change notification
- Unread count
- Mark read
- Mark all read
- Realtime delivery
- Reconnection behavior

### Security

- RLS
- Authorization
- IDOR
- Price manipulation
- Role escalation
- Notification access

---

# 67. END-TO-END TEST

Run the complete real-world scenario:

### Customer

1. Login.
2. Browse products.
3. Open a cake.
4. Select 2 Pound.
5. Select Ferrero flavour.
6. Select any available customization.
7. Upload custom design if enabled.
8. Click Save to Cart.
9. Open Cart.
10. Verify configuration.
11. Verify price.
12. Proceed to Order.
13. Review order.
14. Verify name/email/phone are prefilled.
15. Edit details.
16. Select COD / Pay at Pickup.
17. Confirm and place order.

### System

Verify:

- Exactly one order is created.
- Correct order number.
- Correct item snapshot.
- Correct configuration snapshot.
- Correct price.
- Correct payment method.
- Correct payment state.
- Correct initial status.
- Customer notification created.
- Owner notification created.
- Event history created.

### Owner

1. Receive realtime notification.
2. Open Orders.
3. Open new order.
4. Verify customer details.
5. Verify configuration.
6. Verify custom design.
7. Confirm order.
8. Start baking.
9. Mark ready for pickup.
10. Mark completed.

### Customer

Verify realtime notifications arrive for every valid status change.

Verify the customer order timeline updates.

Verify the final order remains accessible in order history.

---

# 68. REGRESSION TEST

Verify Phase 1:

- Customer login
- Signup
- Google OAuth
- Facebook OAuth
- Logout
- Owner login
- Authorization

Verify Phase 2:

- Store Settings
- Logo
- Store name
- Address
- Contact information
- Social links

Verify Phase 3:

- Products
- Categories
- Variants
- Flavours
- Product images
- Custom design configuration

No previous functionality may regress.

---

# 69. DOCUMENTATION

Update:

### Architecture documentation

Document:

- Cart architecture
- Order architecture
- Payment abstraction
- Order status machine
- Notification architecture
- Realtime
- Events/outbox
- RLS
- Storage

### Developer documentation

Explain:

- How order creation works
- How prices are calculated
- How order snapshots work
- How notifications are generated
- How status transitions work
- How future payment gateways should integrate

### Owner documentation

Explain:

- How to view orders
- How to change statuses
- What each status means
- How notifications work

---

# 70. CI / QUALITY

Run:

- Formatter
- ESLint
- TypeScript
- Unit tests
- Integration tests
- E2E tests
- Production build

Fix actual issues.

Do not:

- Suppress warnings blindly
- Disable type checking
- Skip failing tests
- Hide security problems
- Use temporary hacks as permanent solutions

---

# 71. SECURITY REVIEW

Before completion, explicitly test for:

- Broken access control
- IDOR
- Price manipulation
- Quantity manipulation
- Order total manipulation
- Payment status manipulation
- Status transition bypass
- Customer-to-customer data leakage
- Owner-to-owner data leakage if multiple owners are ever introduced
- Notification leakage
- Storage leakage
- Malicious custom-design uploads
- Replay/duplicate order creation
- Mass assignment
- RLS misconfiguration
- Server/client trust boundary violations

---

# 72. DEFINITION OF DONE

Phase 4 is complete only when:

### Customer

- Cart works.
- Product configurations persist.
- Order Now works.
- Order review works.
- Customer details are prefilled.
- Customer can edit checkout details.
- COD/Pay at Pickup works.
- Order can be successfully placed.
- Confirmation page works.
- Order history works.
- Order details work.
- Notifications work.
- Notification unread count works.
- Realtime status updates work.

### Owner

- Notification icon works.
- New order notification works.
- Orders page works.
- Order detail works.
- Order status changes work.
- Status transition rules work.
- Order timeline works.

### Backend

- Order transactions are reliable.
- Prices are authoritative.
- Order snapshots are immutable.
- Payment abstraction exists.
- Event history exists.
- Notification persistence exists.
- RLS is restrictive.
- Storage is secure.

### Quality

- Tests pass.
- Lint passes.
- Typecheck passes.
- Production build passes.
- Documentation is updated.
- Phases 1–3 remain functional.

---

# 73. MOST IMPORTANT ARCHITECTURAL RULES

## Rule 1 — Never trust the client

The client is only requesting:

> "I want this product configuration."

The server decides:

> "This configuration is valid and costs ₹X."

---

## Rule 2 — Never mutate historical orders

Products can change.

Prices can change.

Flavours can change.

Orders must not.

Orders represent what actually happened.

---

## Rule 3 — Persist notifications

Realtime is a delivery mechanism.

The database is the notification history.

---

## Rule 4 — Use transactions

Order creation must be atomic.

---

## Rule 5 — Use an event/outbox foundation

Do not make notification delivery responsible for order creation success.

---

## Rule 6 — Explicit state machine

Orders cannot randomly jump between statuses.

---

## Rule 7 — Future-proof payments

COD today.

Online payments tomorrow.

Do not hardcode COD assumptions into every layer.

---

## Rule 8 — Keep the architecture modular

Do not introduce unnecessary microservices.

A well-structured modular monolith is preferred for this stage.

---

# 74. FINAL ARCHITECTURE

The target architecture should conceptually be:

```text
                 CUSTOMER
                    │
                    ▼
              Product Detail
                    │
          ┌─────────┴─────────┐
          ▼                   ▼
      Save Cart           Order Now
          │                   │
          ▼                   ▼
      Cart Service       Checkout Service
          │                   │
          └─────────┬─────────┘
                    ▼
             Pricing Engine
                    │
                    ▼
             Order Validation
                    │
                    ▼
              Order Service
                    │
        ┌───────────┼────────────┐
        ▼           ▼            ▼
     Orders      Payment      Order Events
        │           │            │
        │           │            ▼
        │           │        Notification
        │           │            │
        │           │            ▼
        │           │       Supabase Realtime
        │           │            │
        ▼           ▼            ▼
     OWNER       FUTURE       CUSTOMER
   DASHBOARD     GATEWAYS    NOTIFICATION
```

The database should conceptually contain:

```text
customers/profiles
      │
      ├── carts
      │     └── cart_items
      │
      ├── orders
      │     ├── order_items
      │     ├── payments
      │     ├── order_events
      │     └── order_assets
      │
      └── notifications
```

---

# 75. FINAL ENGINEERING REPORT

After implementation, provide a concise but complete report containing:

## Implementation

What was implemented.

## Database

Tables, relationships, constraints, indexes and RLS.

## Cart

Cart architecture and price validation.

## Orders

Order lifecycle and transaction architecture.

## Payments

Current COD implementation and future gateway readiness.

## Notifications

Persistence, event architecture and realtime delivery.

## Storage

Custom design asset handling.

## Security

Authorization, RLS, IDOR, price integrity, upload security and other findings.

## Testing

Actual results for:

- Unit tests
- Integration tests
- E2E tests
- Security tests
- Lint
- Typecheck
- Production build

## Documentation

Files created/updated.

## Skills

AI skills used during implementation.

## Manual Configuration

Anything still required in Supabase/deployment.

## Known Limitations

Only genuine limitations.

## Phase 5 Readiness

Explain whether the system is ready for:

- Offers/promotions
- Online payments
- Advanced pickup scheduling
- Customer communications

---

# FINAL INSTRUCTION

Do not treat this as a simple "cart + checkout" task.

This is the foundation of the bakery's entire commerce system.

Build it as a **production-grade modular commerce architecture**.

The most important priorities are:

1. Data integrity
2. Security
3. Correct pricing
4. Transactional order creation
5. Immutable order snapshots
6. Explicit order state transitions
7. Reliable persisted notifications
8. Real-time UX
9. Excellent customer experience
10. Future payment/offer compatibility
11. Testing
12. Documentation
13. Maintainability

First inspect the existing system.

Then design the data model and state machine.

Then implement the backend/business logic.

Then implement the customer flow.

Then implement the owner flow.

Then implement notifications/realtime.

Then test failure scenarios and concurrency.

Then perform security review.

Then run the complete end-to-end scenario.

Do not declare Phase 4 complete until the entire customer → order → owner → status → customer notification lifecycle works reliably.
