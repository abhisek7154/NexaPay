# NexaPay

> A focused wallet payment demo with UPI and card flows, idempotency, transaction safety, and a small event layer.

[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/) [![TypeScript](https://img.shields.io/badge/TypeScript-7-blue)](https://www.typescriptlang.org/) [![Prisma](https://img.shields.io/badge/Prisma-7-2D3748)](https://www.prisma.io/) [![PostgreSQL](https://img.shields.io/badge/PostgreSQL-supported-336791)](https://www.postgresql.org/)

## What It Does

NexaPay moves money between demo user wallets through a Next.js API. Each payment validates its participants and method, updates both wallets atomically, and records a `SETTLED` transaction. Repeated requests with the same idempotency key replay the original result instead of charging twice.

## Quick Start

```bash
npm install
```

Create a `.env` file with a PostgreSQL connection string:

```env
DATABASE_URL="postgresql://user:password@host:5432/database?sslmode=require"
```

Then prepare the database and start the app:

```bash
npx prisma migrate deploy
npx prisma generate
npx prisma db seed
npm run dev
```

Open `http://localhost:3000`.

## Project Shape

```text
src/
  app/api/v1/              API route handlers
  modules/payments/        payment orchestration and Prisma store
  modules/transactions/    transaction state machine
  modules/events/          event publisher and notifications
  middleware/              API-key authentication helper
prisma/                    PostgreSQL schema, migrations and seed data
docs/ARCHITECTURE.md       detailed architecture reference
```

## Modules

### Payments - implemented

**Submodules:** service, Prisma store and payment types.

- `createPaymentService` coordinates the payment use case
- `createPrismaPaymentStore` connects the service to Prisma
- `PaymentError` maps domain failures to HTTP responses
- Supports `UPI` and `CARD` wallet payments

### Transactions - implemented

**Submodule:** state machine.

- `validTransition` checks allowed state changes
- `transition` applies a valid state change or throws
- Covers pending, processing, authorization, capture, settlement, failure, refunds and disputes

### Events - implemented

**Submodules:** publisher and notification handler.

- `publish` emits versioned transaction events
- `subscribe` registers event listeners
- `initializeNotificationHandler` collects transaction notifications
- `getNotifications` and `clearNotifications` support inspection and tests

### Merchants, Validation and Concurrency - extension points

These folders reserve space for dedicated merchant workflows, reusable validation modules and explicit locking. Today, payment validation is in the payment service and concurrency safety comes from a serializable Prisma transaction.

## Functions And Helpers

The payment service keeps the main use case readable by delegating details to helpers:

| Area | Functions |
| --- | --- |
| Input | `parsePaymentInput`, `asNumber`, `asPaymentMethod` |
| Payment checks | `validateCardDetails`, `passesLuhn`, `isValidUpiId`, `isCardExpired` |
| Money and identity | `toPaise`, `fromPaise`, `normalizeIdempotencyKey`, `createReferenceId` |
| Replay | `buildPaymentResponseFromTransaction` |

## API Endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/v1/payments` | Process a UPI or card wallet payment |
| `POST` | `/api/v1/transactions` | Create a pending transaction directly |
| `GET` | `/api/v1/users/:userId` | Read a user's profile and balance |
| `GET` | `/api/v1/users/:userId/transactions` | Read recent sent and received history |

For payment requests, pass an optional `Idempotency-Key` header. The payment endpoint returns `201` for a new payment and `200` for an idempotent replay.

## Payment Flow

```mermaid
flowchart LR
    A[Client] --> B[POST /api/v1/payments]
    B --> C[Parse and validate input]
    C --> D[Load users and payment method]
    D --> E{Checks pass?}
    E -- No --> F[PaymentError JSON]
    E -- Yes --> G[Serializable Prisma transaction]
    G --> H{Idempotency key found?}
    H -- Yes --> I[Replay original result]
    H -- No --> J[Debit sender wallet]
    J --> K[Credit receiver wallet]
    K --> L[Create SETTLED transaction]
    L --> M[Return payment response]
```

**Guarantees:** money is handled in paise, wallet changes and transaction creation commit together, and a failed transaction rolls back as one unit.

## ER Diagram

```mermaid
erDiagram
    USER ||--o| WALLET : owns
    MERCHANT ||--o{ TRANSACTION : receives
    PAYMENT_METHOD ||--o{ TRANSACTION : uses
    MERCHANT ||--o{ MERCHANT_PAYMENT_METHOD : enables
    PAYMENT_METHOD ||--o{ MERCHANT_PAYMENT_METHOD : configured_for

    USER {
        string id PK
        string email UK
        string upiId UK
        boolean isActive
    }
    WALLET {
        string id PK
        string userId UK
        float balance
    }
    MERCHANT {
        string id PK
        string apiKey UK
        string onboardingStatus
        string kycStatus
    }
    PAYMENT_METHOD {
        string id PK
        string code UK
        boolean isActive
    }
    MERCHANT_PAYMENT_METHOD {
        string merchantId FK
        string paymentMethodId FK
        boolean isActive
    }
    TRANSACTION {
        string id PK
        string merchantId FK
        string paymentMethodId FK
        float amount
        string status
        string idempotencyKey
        string referenceId
    }
```

## Schematic Summary

```text
Client
  -> Next.js API route
  -> Payment service
  -> Validation + idempotency checks
  -> Serializable Prisma transaction
       -> sender wallet (-amount)
       -> receiver wallet (+amount)
       -> transaction record (SETTLED)
  -> JSON response

Transaction events -> EventEmitter -> Notification handler
```

## Commands

```bash
npm run dev       # development server
npm test          # Vitest suite
npm run build     # production build
```

For the longer design notes, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
