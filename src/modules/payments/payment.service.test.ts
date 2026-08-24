import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PaymentError,
  createPaymentService,
  type PaymentStore,
  type PaymentTransactionStore,
} from "./payment.service";

type FakeWallet = {
  id: string;
  userId: string;
  balance: number;
  createdAt: Date;
  updatedAt: Date;
};

type FakeUser = {
  id: string;
  name: string;
  email: string;
  upiId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  wallet: FakeWallet | null;
};

type FakePaymentMethod = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
};

type FakeMerchant = {
  id: string;
  apiKey: string;
};

type FakeTransaction = {
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

type FakeState = {
  users: FakeUser[];
  paymentMethods: FakePaymentMethod[];
  merchant: FakeMerchant;
  transactions: FakeTransaction[];
  failOnCreateTransaction?: boolean;
};

class FakePaymentStore implements PaymentStore {
  private state: FakeState;

  constructor(state?: Partial<FakeState>) {
    const now = new Date("2026-08-24T10:00:00.000Z");

    this.state = {
      users: [
        {
          id: "user_abhishek",
          name: "Abhishek",
          email: "abhishek@nexapay.demo",
          upiId: "abhishek@nexapay",
          isActive: true,
          createdAt: now,
          updatedAt: now,
          wallet: {
            id: "wallet_abhishek",
            userId: "user_abhishek",
            balance: 5000,
            createdAt: now,
            updatedAt: now,
          },
        },
        {
          id: "user_rahul",
          name: "Rahul",
          email: "rahul@nexapay.demo",
          upiId: "rahul@nexapay",
          isActive: true,
          createdAt: now,
          updatedAt: now,
          wallet: {
            id: "wallet_rahul",
            userId: "user_rahul",
            balance: 5000,
            createdAt: now,
            updatedAt: now,
          },
        },
      ],
      paymentMethods: [
        {
          id: "pm_upi",
          code: "UPI",
          name: "Unified Payments Interface",
          isActive: true,
        },
        {
          id: "pm_card",
          code: "CARD",
          name: "Card Payment",
          isActive: true,
        },
      ],
      merchant: {
        id: "merchant_demo",
        apiKey: "test_api_key",
      },
      transactions: [],
      ...state,
    };
  }

  async findUserById(id: string) {
    const user = this.state.users.find((entry) => entry.id === id);
    return user ? structuredClone(user) : null;
  }

  async findPaymentMethodByCode(code: string) {
    const paymentMethod = this.state.paymentMethods.find(
      (entry) => entry.code === code,
    );
    return paymentMethod ? structuredClone(paymentMethod) : null;
  }

  async findDemoMerchant() {
    return structuredClone(this.state.merchant);
  }

  async runInTransaction<T>(
    callback: (tx: PaymentTransactionStore) => Promise<T>,
  ): Promise<T> {
    const txState = structuredClone(this.state);

    const tx: PaymentTransactionStore = {
      findPaymentByIdempotencyKey: async (idempotencyKey) => {
        const transaction = txState.transactions.find(
          (entry) =>
            entry.idempotencyKey === idempotencyKey &&
            entry.customerReference === "WALLET_PAYMENT",
        );

        return transaction ? structuredClone(transaction) : null;
      },
      findWalletByUserId: async (userId) => {
        const user = txState.users.find((entry) => entry.id === userId);
        return user?.wallet ? structuredClone(user.wallet) : null;
      },
      updateWalletBalance: async (userId, balance) => {
        const user = txState.users.find((entry) => entry.id === userId);

        if (!user?.wallet) {
          throw new Error("Wallet not found");
        }

        user.wallet.balance = balance;
        user.wallet.updatedAt = new Date();

        return structuredClone(user.wallet);
      },
      createTransaction: async (input) => {
        if (txState.failOnCreateTransaction) {
          throw new Error("Transaction create failed");
        }

        const now = new Date();
        const transaction: FakeTransaction = {
          id: `txn_${txState.transactions.length + 1}`,
          merchantId: input.merchantId,
          paymentMethodId: input.paymentMethodId,
          customerReference: input.customerReference,
          amount: input.amount,
          currency: input.currency,
          status: input.status,
          idempotencyKey: input.idempotencyKey,
          referenceId: input.referenceId,
          metadata: input.metadata,
          createdAt: now,
          updatedAt: now,
        };

        txState.transactions.push(transaction);

        return structuredClone(transaction);
      },
    };

    const result = await callback(tx);
    this.state = txState;

    return result;
  }

  getBalance(userId: string): number {
    const user = this.state.users.find((entry) => entry.id === userId);
    return user?.wallet?.balance ?? 0;
  }

  getTransactions(): FakeTransaction[] {
    return structuredClone(this.state.transactions);
  }
}

describe("payment service", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-24T10:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("processes a valid UPI payment", async () => {
    const store = new FakePaymentStore();
    const service = createPaymentService(store);

    const result = await service({
      senderId: "user_abhishek",
      receiverId: "user_rahul",
      amount: 500,
      paymentMethod: "UPI",
      upiId: "rahul@nexapay",
    });

    expect(result.idempotentReplay).toBe(false);
    expect(result.payment.paymentMethod).toBe("UPI");
    expect(result.payment.amount).toBe(500);
    expect(result.payment.senderUpdatedBalance).toBe(4500);
    expect(result.payment.status).toBe("SETTLED");
  });

  it("processes a valid CARD payment without storing raw card data", async () => {
    const store = new FakePaymentStore();
    const service = createPaymentService(store);

    const result = await service({
      senderId: "user_abhishek",
      receiverId: "user_rahul",
      amount: 500,
      paymentMethod: "CARD",
      card: {
        cardNumber: "4111111111111111",
        cardHolderName: "ABHISEK",
        expiry: "12/30",
        cvv: "123",
      },
    });

    const [transaction] = store.getTransactions();

    expect(result.payment.paymentMethod).toBe("CARD");
    expect(transaction?.metadata).toContain("1111");
    expect(transaction?.metadata).not.toContain("4111111111111111");
    expect(transaction?.metadata).not.toContain("123");
  });

  it("rejects insufficient balance", async () => {
    const store = new FakePaymentStore({
      users: [
        {
          id: "user_abhishek",
          name: "Abhishek",
          email: "abhishek@nexapay.demo",
          upiId: "abhishek@nexapay",
          isActive: true,
          createdAt: new Date("2026-08-24T10:00:00.000Z"),
          updatedAt: new Date("2026-08-24T10:00:00.000Z"),
          wallet: {
            id: "wallet_abhishek",
            userId: "user_abhishek",
            balance: 100,
            createdAt: new Date("2026-08-24T10:00:00.000Z"),
            updatedAt: new Date("2026-08-24T10:00:00.000Z"),
          },
        },
        {
          id: "user_rahul",
          name: "Rahul",
          email: "rahul@nexapay.demo",
          upiId: "rahul@nexapay",
          isActive: true,
          createdAt: new Date("2026-08-24T10:00:00.000Z"),
          updatedAt: new Date("2026-08-24T10:00:00.000Z"),
          wallet: {
            id: "wallet_rahul",
            userId: "user_rahul",
            balance: 5000,
            createdAt: new Date("2026-08-24T10:00:00.000Z"),
            updatedAt: new Date("2026-08-24T10:00:00.000Z"),
          },
        },
      ],
    });
    const service = createPaymentService(store);

    await expect(
      service({
        senderId: "user_abhishek",
        receiverId: "user_rahul",
        amount: 500,
        paymentMethod: "UPI",
        upiId: "rahul@nexapay",
      }),
    ).rejects.toMatchObject({
      message: "Insufficient balance",
      status: 409,
    });
  });

  it("rejects self-payment", async () => {
    const store = new FakePaymentStore();
    const service = createPaymentService(store);

    await expect(
      service({
        senderId: "user_abhishek",
        receiverId: "user_abhishek",
        amount: 100,
        paymentMethod: "UPI",
        upiId: "abhishek@nexapay",
      }),
    ).rejects.toMatchObject({
      message: "Sender and receiver must be different",
      status: 400,
    });
  });

  it("rejects an invalid UPI ID", async () => {
    const store = new FakePaymentStore();
    const service = createPaymentService(store);

    await expect(
      service({
        senderId: "user_abhishek",
        receiverId: "user_rahul",
        amount: 100,
        paymentMethod: "UPI",
        upiId: "wrong@nexapay",
      }),
    ).rejects.toMatchObject({
      message: "Invalid UPI ID",
      status: 400,
    });
  });

  it("rejects an invalid card number", async () => {
    const store = new FakePaymentStore();
    const service = createPaymentService(store);

    await expect(
      service({
        senderId: "user_abhishek",
        receiverId: "user_rahul",
        amount: 100,
        paymentMethod: "CARD",
        card: {
          cardNumber: "4111111111111112",
          cardHolderName: "ABHISEK",
          expiry: "12/30",
          cvv: "123",
        },
      }),
    ).rejects.toMatchObject({
      message: "Invalid CARD details",
      status: 400,
    });
  });

  it("rejects an expired card", async () => {
    const store = new FakePaymentStore();
    const service = createPaymentService(store);

    await expect(
      service({
        senderId: "user_abhishek",
        receiverId: "user_rahul",
        amount: 100,
        paymentMethod: "CARD",
        card: {
          cardNumber: "4111111111111111",
          cardHolderName: "ABHISEK",
          expiry: "07/26",
          cvv: "123",
        },
      }),
    ).rejects.toMatchObject({
      message: "Card is expired",
      status: 400,
    });
  });

  it("rejects an invalid amount", async () => {
    const store = new FakePaymentStore();
    const service = createPaymentService(store);

    await expect(
      service({
        senderId: "user_abhishek",
        receiverId: "user_rahul",
        amount: 0,
        paymentMethod: "UPI",
        upiId: "rahul@nexapay",
      }),
    ).rejects.toMatchObject({
      message: "Invalid amount",
      status: 400,
    });
  });

  it("decreases the sender balance after a successful payment", async () => {
    const store = new FakePaymentStore();
    const service = createPaymentService(store);

    await service({
      senderId: "user_abhishek",
      receiverId: "user_rahul",
      amount: 500,
      paymentMethod: "UPI",
      upiId: "rahul@nexapay",
    });

    expect(store.getBalance("user_abhishek")).toBe(4500);
  });

  it("increases the receiver balance after a successful payment", async () => {
    const store = new FakePaymentStore();
    const service = createPaymentService(store);

    await service({
      senderId: "user_abhishek",
      receiverId: "user_rahul",
      amount: 500,
      paymentMethod: "UPI",
      upiId: "rahul@nexapay",
    });

    expect(store.getBalance("user_rahul")).toBe(5500);
  });

  it("leaves both balances unchanged when transaction creation fails", async () => {
    const store = new FakePaymentStore({
      failOnCreateTransaction: true,
    });
    const service = createPaymentService(store);

    await expect(
      service({
        senderId: "user_abhishek",
        receiverId: "user_rahul",
        amount: 500,
        paymentMethod: "UPI",
        upiId: "rahul@nexapay",
      }),
    ).rejects.toThrow("Transaction create failed");

    expect(store.getBalance("user_abhishek")).toBe(5000);
    expect(store.getBalance("user_rahul")).toBe(5000);
  });
});
