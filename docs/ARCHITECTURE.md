# NexaPay Architecture

## Stack
- Next.js + TypeScript
- Prisma ORM
- SQLite
- Zod
- Vitest

## Modules

### 1. Merchant
- Create / manage merchants
- API-key authentication
- Onboarding & KYC status

### 2. Payment Methods
- Payment method configuration
- Merchant-payment-method mapping
- Fees and limits

### 3. Transactions
- Create transaction
- Validate transaction
- Idempotency
- Transaction state management

### 4. Validation
Order:
1. Schema validation
2. Entity validation
3. Business rules
4. Compliance
5. Risk

### 5. Events
- Transaction events
- Notifications
- Dead Letter Queue

### 6. Concurrency
- Per-transaction locking
- Prevent duplicate processing

## Main Flow

Request
→ Authentication
→ Idempotency
→ Schema Validation
→ Entity Validation
→ Business Rules
→ Compliance
→ Risk
→ Create Transaction
→ Publish Event
→ Notification

## Database

Merchant
→ MerchantPaymentMethod
→ PaymentMethod

Merchant
→ Transaction
→ PaymentMethod