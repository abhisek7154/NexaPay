import crypto from "node:crypto";
import { Prisma, type PrismaClient } from "../../generated/prisma/client";

const DEMO_MERCHANT_API_KEY = "test_api_key";
const WALLET_PAYMENT_REFERENCE = "WALLET_PAYMENT";
const PAYMENT_METHODS = ["UPI", "CARD"] as const;

type PaymentMethodCode = (typeof PAYMENT_METHODS)[number];

type CardInput = {
  cardNumber: string;
  cardHolderName: string;
  expiry: string;
  cvv: string;
};

type RawPaymentInput = {
  senderId: unknown;
  receiverId: unknown;
  amount: unknown;
  paymentMethod: unknown;
  upiId?: unknown;
  card?: unknown;
};

type PaymentInput = {
  senderId: string;
  receiverId: string;
  amount: number;
  paymentMethod: PaymentMethodCode;
  upiId?: string;
  card?: CardInput;
};

type PaymentWallet = {
  id: string;
  userId: string;
  balance: number;
  createdAt: Date;
  updatedAt: Date;
};

type PaymentUser = {
  id: string;
  name: string;
  email: string;
  upiId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  wallet: PaymentWallet | null;
};

type PaymentMethodRecord = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
};

type MerchantRecord = {
  id: string;
  apiKey: string;
};

type PaymentTransactionRecord = {
  id: string;
  merchantId: string;
  paymentMethodId: string;
  customerReference: string | null;
  amount: number;
  currency: string;
  status: string;
  idempotencyKey: string;
  referenceId: string;
  metadata: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type WalletPaymentMetadata = {
  kind: "wallet_payment";
  senderId: string;
  senderName: string;
  receiverId: string;
  receiverName: string;
  receiverUpiId: string;
  amountPaise: number;
  paymentMethod: PaymentMethodCode;
  senderBalanceAfterPaise: number;
  cardLast4?: string;
  upiId?: string;
};

type CreateTransactionInput = {
  merchantId: string;
  paymentMethodId: string;
  customerReference: string;
  amount: number;
  currency: string;
  status: string;
  idempotencyKey: string;
  referenceId: string;
  metadata: string;
};

export type PaymentSuccess = {
  transactionId: string;
  sender: {
    id: string;
    name: string;
  };
  receiver: {
    id: string;
    name: string;
  };
  amount: number;
  paymentMethod: PaymentMethodCode;
  status: string;
  timestamp: string;
  senderUpdatedBalance: number;
};

export class PaymentError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "PaymentError";
    this.status = status;
  }
}

export interface PaymentTransactionStore {
  findPaymentByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<PaymentTransactionRecord | null>;
  findWalletByUserId(userId: string): Promise<PaymentWallet | null>;
  updateWalletBalance(userId: string, balance: number): Promise<PaymentWallet>;
  createTransaction(
    input: CreateTransactionInput,
  ): Promise<PaymentTransactionRecord>;
}

export interface PaymentStore {
  findUserById(id: string): Promise<PaymentUser | null>;
  findPaymentMethodByCode(code: string): Promise<PaymentMethodRecord | null>;
  findDemoMerchant(): Promise<MerchantRecord | null>;
  runInTransaction<T>(
    callback: (tx: PaymentTransactionStore) => Promise<T>,
  ): Promise<T>;
}

export function createPrismaPaymentStore(prisma: PrismaClient): PaymentStore {
  return {
    async findUserById(id) {
      return prisma.user.findUnique({
        where: { id },
        include: { wallet: true },
      });
    },
    async findPaymentMethodByCode(code) {
      return prisma.paymentMethod.findUnique({
        where: { code },
      });
    },
    async findDemoMerchant() {
      return prisma.merchant.findUnique({
        where: { apiKey: DEMO_MERCHANT_API_KEY },
      });
    },
    async runInTransaction(callback) {
      return prisma.$transaction(
        async (tx) =>
          callback({
            async findPaymentByIdempotencyKey(idempotencyKey) {
              return tx.transaction.findFirst({
                where: {
                  idempotencyKey,
                  customerReference: WALLET_PAYMENT_REFERENCE,
                },
              });
            },
            async findWalletByUserId(userId) {
              return tx.wallet.findUnique({
                where: { userId },
              });
            },
            async updateWalletBalance(userId, balance) {
              return tx.wallet.update({
                where: { userId },
                data: { balance },
              });
            },
            async createTransaction(input) {
              return tx.transaction.create({
                data: input,
              });
            },
          }),
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );
    },
  };
}

export function createPaymentService(store: PaymentStore) {
  return async function createPayment(
    rawInput: unknown,
    options?: { idempotencyKey?: string },
  ): Promise<{ payment: PaymentSuccess; idempotentReplay: boolean }> {
    const input = parsePaymentInput(rawInput);

    const sender = await store.findUserById(input.senderId);

    if (!sender?.wallet) {
      throw new PaymentError(404, "Sender not found");
    }

    if (!sender.isActive) {
      throw new PaymentError(400, "Sender is inactive");
    }

    const receiver = await store.findUserById(input.receiverId);

    if (!receiver?.wallet) {
      throw new PaymentError(404, "Receiver not found");
    }

    if (!receiver.isActive) {
      throw new PaymentError(400, "Receiver is inactive");
    }

    const amountPaise = toPaise(input.amount);

    if (sender.id === receiver.id) {
      throw new PaymentError(400, "Sender and receiver must be different");
    }

    const paymentMethod = await store.findPaymentMethodByCode(input.paymentMethod);

    if (!paymentMethod?.isActive) {
      throw new PaymentError(400, "Unsupported or inactive payment method");
    }

    let cardLast4: string | undefined;

    if (input.paymentMethod === "UPI") {
      if (!input.upiId || !isValidUpiId(input.upiId) || input.upiId !== receiver.upiId) {
        throw new PaymentError(400, "Invalid UPI ID");
      }
    }

    if (input.paymentMethod === "CARD") {
      const card = validateCardDetails(input.card);
      cardLast4 = card.cardNumber.slice(-4);
    }

    const senderBalancePaise = toPaise(sender.wallet.balance);

    if (senderBalancePaise < amountPaise) {
      throw new PaymentError(409, "Insufficient balance");
    }

    const merchant = await store.findDemoMerchant();

    if (!merchant) {
      throw new PaymentError(500, "Payment service unavailable");
    }

    const idempotencyKey = normalizeIdempotencyKey(options?.idempotencyKey);

    return store.runInTransaction(async (tx) => {
      const existingTransaction = await tx.findPaymentByIdempotencyKey(idempotencyKey);

      if (existingTransaction) {
        return {
          payment: buildPaymentResponseFromTransaction(existingTransaction),
          idempotentReplay: true,
        };
      }

      const senderWallet = await tx.findWalletByUserId(sender.id);
      const receiverWallet = await tx.findWalletByUserId(receiver.id);

      if (!senderWallet || !receiverWallet) {
        throw new PaymentError(404, "Wallet not found");
      }

      const currentSenderBalancePaise = toPaise(senderWallet.balance);

      if (currentSenderBalancePaise < amountPaise) {
        throw new PaymentError(409, "Insufficient balance");
      }

      const currentReceiverBalancePaise = toPaise(receiverWallet.balance);
      const senderBalanceAfterPaise = currentSenderBalancePaise - amountPaise;
      const receiverBalanceAfterPaise = currentReceiverBalancePaise + amountPaise;

      await tx.updateWalletBalance(
        sender.id,
        fromPaise(senderBalanceAfterPaise),
      );
      await tx.updateWalletBalance(
        receiver.id,
        fromPaise(receiverBalanceAfterPaise),
      );

      const metadata: WalletPaymentMetadata = {
        kind: "wallet_payment",
        senderId: sender.id,
        senderName: sender.name,
        receiverId: receiver.id,
        receiverName: receiver.name,
        receiverUpiId: receiver.upiId,
        amountPaise,
        paymentMethod: input.paymentMethod,
        senderBalanceAfterPaise,
        ...(cardLast4 ? { cardLast4 } : {}),
        ...(input.upiId ? { upiId: input.upiId } : {}),
      };

      const transaction = await tx.createTransaction({
        merchantId: merchant.id,
        paymentMethodId: paymentMethod.id,
        customerReference: WALLET_PAYMENT_REFERENCE,
        amount: fromPaise(amountPaise),
        currency: "INR",
        status: "SETTLED",
        idempotencyKey,
        referenceId: createReferenceId(),
        metadata: JSON.stringify(metadata),
      });

      return {
        payment: {
          transactionId: transaction.id,
          sender: {
            id: sender.id,
            name: sender.name,
          },
          receiver: {
            id: receiver.id,
            name: receiver.name,
          },
          amount: fromPaise(amountPaise),
          paymentMethod: input.paymentMethod,
          status: transaction.status,
          timestamp: transaction.createdAt.toISOString(),
          senderUpdatedBalance: fromPaise(senderBalanceAfterPaise),
        },
        idempotentReplay: false,
      };
    });
  };
}

function parsePaymentInput(rawInput: unknown): PaymentInput {
  if (!isRecord(rawInput)) {
    throw new PaymentError(400, "Invalid payment request");
  }

  const input = rawInput as RawPaymentInput;
  const senderId = asNonEmptyString(input.senderId, "Invalid sender");
  const receiverId = asNonEmptyString(input.receiverId, "Invalid receiver");
  const amount = asNumber(input.amount);
  const paymentMethod = asPaymentMethod(input.paymentMethod);

  if (paymentMethod === "UPI") {
    return {
      senderId,
      receiverId,
      amount,
      paymentMethod,
      upiId: asNonEmptyString(input.upiId, "Invalid UPI ID"),
    };
  }

  const card = input.card as CardInput | undefined;

  return {
    senderId,
    receiverId,
    amount,
    paymentMethod,
    ...(card ? { card } : {}),
  };
}

function asNonEmptyString(value: unknown, message: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new PaymentError(400, message);
  }

  return value.trim();
}

function asNumber(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new PaymentError(400, "Invalid amount");
  }

  const paise = Math.round((value + Number.EPSILON) * 100);

  if (Math.abs(value - paise / 100) > 0.000001) {
    throw new PaymentError(400, "Invalid amount");
  }

  return value;
}

function asPaymentMethod(value: unknown): PaymentMethodCode {
  if (typeof value !== "string") {
    throw new PaymentError(400, "Unsupported or inactive payment method");
  }

  const normalizedValue = value.trim().toUpperCase();

  if (normalizedValue !== "UPI" && normalizedValue !== "CARD") {
    throw new PaymentError(400, "Unsupported or inactive payment method");
  }

  return normalizedValue;
}

function validateCardDetails(card: CardInput | undefined): CardInput {
  if (!isRecord(card)) {
    throw new PaymentError(400, "Invalid CARD details");
  }

  const cardNumber = normalizeCardNumber(card.cardNumber);
  const cardHolderName = asNonEmptyString(
    card.cardHolderName,
    "Invalid CARD details",
  );
  const expiry = asNonEmptyString(card.expiry, "Invalid CARD details");
  const cvv = asNonEmptyString(card.cvv, "Invalid CARD details");

  if (!passesLuhn(cardNumber)) {
    throw new PaymentError(400, "Invalid CARD details");
  }

  if (!/^\d{3,4}$/.test(cvv)) {
    throw new PaymentError(400, "Invalid CARD details");
  }

  if (isCardExpired(expiry)) {
    throw new PaymentError(400, "Card is expired");
  }

  return {
    cardNumber,
    cardHolderName,
    expiry,
    cvv,
  };
}

function normalizeCardNumber(value: unknown): string {
  if (typeof value !== "string") {
    throw new PaymentError(400, "Invalid CARD details");
  }

  const normalizedValue = value.replace(/[\s-]/g, "");

  if (!/^\d{12,19}$/.test(normalizedValue)) {
    throw new PaymentError(400, "Invalid CARD details");
  }

  return normalizedValue;
}

function passesLuhn(cardNumber: string): boolean {
  let sum = 0;
  let shouldDouble = false;

  for (let index = cardNumber.length - 1; index >= 0; index -= 1) {
    let digit = Number(cardNumber[index]);

    if (shouldDouble) {
      digit *= 2;

      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}

function isCardExpired(expiry: string): boolean {
  const match = expiry.match(/^(\d{2})\/(\d{2})$/);

  if (!match) {
    throw new PaymentError(400, "Invalid CARD details");
  }

  const month = Number(match[1]);
  const year = Number(match[2]);

  if (month < 1 || month > 12) {
    throw new PaymentError(400, "Invalid CARD details");
  }

  const fullYear = 2000 + year;
  const expirationDate = new Date(fullYear, month, 0, 23, 59, 59, 999);

  return expirationDate.getTime() < Date.now();
}

function isValidUpiId(upiId: string): boolean {
  return /^[a-z0-9._-]{2,}@[a-z]{2,}$/i.test(upiId);
}

function toPaise(amount: number): number {
  const paise = Math.round((amount + Number.EPSILON) * 100);

  if (!Number.isSafeInteger(paise) || paise <= 0) {
    throw new PaymentError(400, "Invalid amount");
  }

  return paise;
}

function fromPaise(paise: number): number {
  return paise / 100;
}

function normalizeIdempotencyKey(idempotencyKey: string | undefined): string {
  if (typeof idempotencyKey === "string" && idempotencyKey.trim().length > 0) {
    return idempotencyKey.trim();
  }

  return crypto.randomUUID();
}

function createReferenceId(): string {
  return `PAY-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
}

function buildPaymentResponseFromTransaction(
  transaction: PaymentTransactionRecord,
): PaymentSuccess {
  const metadata = parseWalletPaymentMetadata(transaction.metadata);

  return {
    transactionId: transaction.id,
    sender: {
      id: metadata.senderId,
      name: metadata.senderName,
    },
    receiver: {
      id: metadata.receiverId,
      name: metadata.receiverName,
    },
    amount: fromPaise(metadata.amountPaise),
    paymentMethod: metadata.paymentMethod,
    status: transaction.status,
    timestamp: transaction.createdAt.toISOString(),
    senderUpdatedBalance: fromPaise(metadata.senderBalanceAfterPaise),
  };
}

function parseWalletPaymentMetadata(
  metadata: string | null,
): WalletPaymentMetadata {
  if (!metadata) {
    throw new PaymentError(500, "Stored payment metadata is invalid");
  }

  const parsedValue = JSON.parse(metadata) as Partial<WalletPaymentMetadata>;

  if (parsedValue.kind !== "wallet_payment") {
    throw new PaymentError(500, "Stored payment metadata is invalid");
  }

  if (
    typeof parsedValue.senderId !== "string" ||
    typeof parsedValue.senderName !== "string" ||
    typeof parsedValue.receiverId !== "string" ||
    typeof parsedValue.receiverName !== "string" ||
    typeof parsedValue.receiverUpiId !== "string" ||
    typeof parsedValue.amountPaise !== "number" ||
    typeof parsedValue.senderBalanceAfterPaise !== "number" ||
    (parsedValue.paymentMethod !== "UPI" && parsedValue.paymentMethod !== "CARD")
  ) {
    throw new PaymentError(500, "Stored payment metadata is invalid");
  }

  return {
    kind: "wallet_payment",
    senderId: parsedValue.senderId,
    senderName: parsedValue.senderName,
    receiverId: parsedValue.receiverId,
    receiverName: parsedValue.receiverName,
    receiverUpiId: parsedValue.receiverUpiId,
    amountPaise: parsedValue.amountPaise,
    paymentMethod: parsedValue.paymentMethod,
    senderBalanceAfterPaise: parsedValue.senderBalanceAfterPaise,
    ...(parsedValue.cardLast4 ? { cardLast4: parsedValue.cardLast4 } : {}),
    ...(parsedValue.upiId ? { upiId: parsedValue.upiId } : {}),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
