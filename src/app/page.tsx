"use client";

import { type CSSProperties, useEffect, useMemo, useState } from "react";

type PaymentMethod = "UPI" | "CARD";

type User = {
  id: string;
  name: string;
  upiId: string;
  balance: number;
};

type MessageState = {
  type: "success" | "error";
  text: string;
};

type SuccessState = {
  transactionId: string;
  receiverUpiId: string;
  status: string;
  amount: number;
  remainingBalance: number;
};

type HistoryItem = {
  id: string;
  type: "Sent" | "Received";
  amount: number;
  counterparty: string;
  method: string;
  status: string;
};

const seededUsers: User[] = [
  {
    id: "cmt744sko0001e0kic0zl9eef",
    name: "Abhishek",
    upiId: "abhishek@nexapay",
    balance: 5000,
  },
  {
    id: "cmt744tak0003e0kityo7jrm6",
    name: "Rahul",
    upiId: "rahul@nexapay",
    balance: 5000,
  },
];

const defaultUser = seededUsers[0]!;
const defaultReceiver = seededUsers[1]!;

const initialCard = {
  cardNumber: "",
  cardHolderName: "",
  expiry: "",
  cvv: "",
};

const formatCurrency = (value: number) =>
  `₹${value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatHistoryAmount = (value: number) =>
  `${value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

function isValidCardNumber(cardNumber: string) {
  const cleaned = cardNumber.replace(/[\s-]/g, "");
  if (!/^\d{12,19}$/.test(cleaned)) {
    return false;
  }

  let sum = 0;
  let shouldDouble = false;

  for (let index = cleaned.length - 1; index >= 0; index -= 1) {
    let digit = Number(cleaned[index]);

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

function isValidExpiry(expiry: string) {
  const match = expiry.match(/^(\d{2})\/(\d{2})$/);

  if (!match) {
    return false;
  }

  const month = Number(match[1]);
  const year = Number(match[2]);

  if (month < 1 || month > 12) {
    return false;
  }

  const fullYear = 2000 + year;
  const expirationDate = new Date(fullYear, month, 0, 23, 59, 59, 999);

  return expirationDate.getTime() >= Date.now();
}

function isValidUpiId(value: string) {
  return /^[a-z0-9._-]{2,}@[a-z]{2,}$/i.test(value);
}

export default function Home() {
  const [users, setUsers] = useState<Record<string, User>>(() =>
    Object.fromEntries(seededUsers.map((user) => [user.id, user])),
  );
  const [currentUserId, setCurrentUserId] = useState(defaultUser.id);
  const [receiverId, setReceiverId] = useState(defaultReceiver.id);
  const [amount, setAmount] = useState("500");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("UPI");
  const [upiId, setUpiId] = useState(defaultReceiver.upiId);
  const [card, setCard] = useState(initialCard);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState<MessageState | null>(null);
  const [successState, setSuccessState] = useState<SuccessState | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const currentUser = users[currentUserId] ?? defaultUser;
  const receiver = users[receiverId] ?? defaultReceiver;

  const receiverOptions = useMemo(
    () => seededUsers.filter((user) => user.id !== currentUserId),
    [currentUserId],
  );

  useEffect(() => {
    const selectedReceiver = receiverOptions[0] ?? defaultReceiver;
    setReceiverId(selectedReceiver.id);
    setUpiId(selectedReceiver.upiId);
    setMessage(null);
    setSuccessState(null);

    const loadUser = async () => {
      try {
        const response = await fetch(`/api/v1/users/${currentUserId}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const data = await response.json();

        if (data?.user) {
          setUsers((previous) => ({
            ...previous,
            [currentUserId]: {
              id: currentUserId,
              name: data.user.name,
              upiId: data.user.upiId,
              balance: Number(data.user.balance ?? previous[currentUserId]?.balance ?? 0),
            },
          }));
        }
      } catch {
        // Ignore and keep seeded value for demo fallback.
      }
    };

    const loadHistory = async () => {
      try {
        const response = await fetch(`/api/v1/users/${currentUserId}/transactions`, {
          cache: "no-store",
        });

        if (!response.ok) {
          setHistory([]);
          return;
        }

        const data = await response.json();
        setHistory(Array.isArray(data?.transactions) ? data.transactions : []);
      } catch {
        setHistory([]);
      }
    };

    void loadUser();
    void loadHistory();
  }, [currentUserId]);

  async function refreshUserState() {
    try {
      const response = await fetch(`/api/v1/users/${currentUserId}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        return;
      }

      const data = await response.json();

      if (data?.user) {
        setUsers((previous) => ({
          ...previous,
          [currentUserId]: {
            id: currentUserId,
            name: data.user.name,
            upiId: data.user.upiId,
            balance: Number(data.user.balance ?? previous[currentUserId]?.balance ?? 0),
          },
        }));
      }
    } catch {
      // Ignore demo fallback.
    }
  }

  async function refreshHistoryState() {
    try {
      const response = await fetch(`/api/v1/users/${currentUserId}/transactions`, {
        cache: "no-store",
      });

      if (!response.ok) {
        return;
      }

      const data = await response.json();
      setHistory(Array.isArray(data?.transactions) ? data.transactions : []);
    } catch {
      // Ignore demo fallback.
    }
  }

  function updateUserBalance(userId: string, nextBalance: number) {
    setUsers((previous) => {
      const baseUser = previous[userId] ?? seededUsers.find((user) => user.id === userId) ?? defaultUser;

      return {
        ...previous,
        [userId]: {
          ...baseUser,
          balance: nextBalance,
        },
      };
    });
  }

  function resetCard() {
    setCard({ ...initialCard });
  }

  async function handlePayment() {
    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setMessage({ type: "error", text: "Invalid amount" });
      setSuccessState(null);
      return;
    }

    if (currentUserId === receiverId) {
      setMessage({ type: "error", text: "You cannot pay yourself" });
      setSuccessState(null);
      return;
    }

    if (paymentMethod === "UPI") {
      if (!isValidUpiId(receiver.upiId)) {
        setMessage({ type: "error", text: "Invalid UPI ID" });
        setSuccessState(null);
        return;
      }
    }

    if (paymentMethod === "CARD") {
      if (!isValidCardNumber(card.cardNumber)) {
        setMessage({ type: "error", text: "Invalid card number" });
        setSuccessState(null);
        return;
      }

      if (!card.cardHolderName.trim()) {
        setMessage({ type: "error", text: "Invalid card number" });
        setSuccessState(null);
        return;
      }

      if (!isValidExpiry(card.expiry)) {
        setMessage({ type: "error", text: "Card expired" });
        setSuccessState(null);
        return;
      }

      if (!/^\d{3,4}$/.test(card.cvv)) {
        setMessage({ type: "error", text: "Invalid CVV" });
        setSuccessState(null);
        return;
      }
    }

    setProcessing(true);
    setMessage(null);
    setSuccessState(null);

    try {
      const response = await fetch("/api/v1/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `nexapay-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        },
        body: JSON.stringify({
          senderId: currentUserId,
          receiverId,
          amount: numericAmount,
          paymentMethod,
          ...(paymentMethod === "UPI"
            ? { upiId: receiver.upiId }
            : {
                card: {
                  cardNumber: card.cardNumber,
                  cardHolderName: card.cardHolderName,
                  expiry: card.expiry,
                  cvv: card.cvv,
                },
              }),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data?.success) {
        const errorMessage = typeof data?.error === "string" ? data.error : "Payment failed";
        const mappedMessage =
          errorMessage === "Sender and receiver must be different"
            ? "You cannot pay yourself"
            : errorMessage === "Sender not found"
              ? "Sender not found"
              : errorMessage === "Receiver not found"
                ? "Receiver not found"
                : errorMessage === "Invalid UPI ID"
                  ? "Invalid UPI ID"
                  : errorMessage === "Invalid amount"
                    ? "Invalid amount"
                    : errorMessage === "Insufficient balance"
                      ? "Insufficient balance"
                      : errorMessage === "Card is expired"
                        ? "Card expired"
                        : errorMessage === "Invalid CARD details"
                          ? "Invalid card number"
                          : errorMessage === "Invalid CVV"
                            ? "Invalid CVV"
                            : errorMessage === "Payment method not found"
                              ? "Payment method not found"
                              : errorMessage === "Unsupported or inactive payment method"
                                ? "Payment method not found"
                                : "Payment failed";

        setMessage({ type: "error", text: mappedMessage });
        return;
      }

      const result = data.data;
      const remainingBalance = Number((currentUser.balance - numericAmount).toFixed(2));
      const nextReceiverBalance = Number((receiver.balance + numericAmount).toFixed(2));

      updateUserBalance(currentUserId, remainingBalance);
      updateUserBalance(receiverId, nextReceiverBalance);
      setMessage({ type: "success", text: "Payment Successful" });
      setSuccessState({
        transactionId: result.transactionId,
        receiverUpiId: receiver.upiId,
        status: result.status,
        amount: numericAmount,
        remainingBalance,
      });
      resetCard();
      await refreshUserState();
      await refreshHistoryState();
    } catch {
      setMessage({ type: "error", text: "Payment failed" });
    } finally {
      setProcessing(false);
    }
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <h1 style={styles.title}>NexaPay</h1>
        </header>

        <section style={styles.card}>
          <div style={styles.rowBetween}>
            <div>
              <div style={styles.label}>Current User</div>
              <select
                aria-label="Current User"
                value={currentUserId}
                onChange={(event) => {
                  const nextUserId = event.target.value;
                  setCurrentUserId(nextUserId);
                  const selectedReceiver = seededUsers.find((user) => user.id !== nextUserId) ?? defaultReceiver;
                  setReceiverId(selectedReceiver.id);
                  setUpiId(selectedReceiver.upiId);
                  setSuccessState(null);
                  setMessage(null);
                }}
                style={styles.select}
              >
                {seededUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={styles.balanceRow}>
            <span style={styles.balanceLabel}>Balance:</span>
            <strong>{formatCurrency(currentUser.balance)}</strong>
          </div>
          <div style={styles.balanceRow}>
            <span style={styles.balanceLabel}>UPI ID:</span>
            <strong>{currentUser.upiId}</strong>
          </div>
        </section>

        <section style={styles.formCard}>
          <div style={styles.fieldRow}>
            <label style={styles.label}>Receiver</label>
            <select
              aria-label="Receiver"
              value={receiverId}
              onChange={(event) => {
                const nextReceiverId = event.target.value;
                if (nextReceiverId === currentUserId) {
                  setMessage({ type: "error", text: "You cannot pay yourself" });
                  return;
                }
                setReceiverId(nextReceiverId);
                const selectedReceiver = users[nextReceiverId] ?? seededUsers.find((user) => user.id === nextReceiverId) ?? defaultReceiver;
                setUpiId(selectedReceiver.upiId);
                setSuccessState(null);
                setMessage(null);
              }}
              style={styles.select}
            >
              {receiverOptions.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.fieldRow}>
            <label style={styles.label}>Amount</label>
            <input
              aria-label="Amount"
              type="number"
              min="1"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="₹500"
              style={styles.input}
            />
          </div>

          <div style={styles.fieldRow}>
            <div style={styles.label}>Payment Method</div>
            <div style={styles.radioGroup}>
              <label style={styles.radioLabel}>
                <input
                  type="radio"
                  checked={paymentMethod === "UPI"}
                  onChange={() => setPaymentMethod("UPI")}
                />
                UPI
              </label>
              <label style={styles.radioLabel}>
                <input
                  type="radio"
                  checked={paymentMethod === "CARD"}
                  onChange={() => setPaymentMethod("CARD")}
                />
                Credit Card
              </label>
            </div>
          </div>

          {paymentMethod === "UPI" ? (
            <div style={styles.fieldRow}>
              <label style={styles.label}>Receiver UPI ID</label>
              <input
                aria-label="Receiver UPI ID"
                type="text"
                value={upiId || receiver.upiId}
                onChange={(event) => setUpiId(event.target.value)}
                style={styles.input}
              />
            </div>
          ) : (
            <div style={styles.cardGrid}>
              <div style={styles.fieldRow}>
                <label style={styles.label}>Card Number</label>
                <input
                  aria-label="Card Number"
                  type="text"
                  value={card.cardNumber}
                  onChange={(event) => setCard((previous) => ({ ...previous, cardNumber: event.target.value }))}
                  style={styles.input}
                  placeholder="1234 5678 9012 3456"
                />
              </div>
              <div style={styles.fieldRow}>
                <label style={styles.label}>Card Holder Name</label>
                <input
                  aria-label="Card Holder Name"
                  type="text"
                  value={card.cardHolderName}
                  onChange={(event) => setCard((previous) => ({ ...previous, cardHolderName: event.target.value }))}
                  style={styles.input}
                  placeholder="Abhishek Kumar"
                />
              </div>
              <div style={styles.fieldRow}>
                <label style={styles.label}>Expiry MM/YY</label>
                <input
                  aria-label="Expiry MM/YY"
                  type="text"
                  value={card.expiry}
                  onChange={(event) => setCard((previous) => ({ ...previous, expiry: event.target.value }))}
                  style={styles.input}
                  placeholder="12/29"
                />
              </div>
              <div style={styles.fieldRow}>
                <label style={styles.label}>CVV</label>
                <input
                  aria-label="CVV"
                  type="password"
                  value={card.cvv}
                  onChange={(event) => setCard((previous) => ({ ...previous, cvv: event.target.value }))}
                  style={styles.input}
                  placeholder="123"
                />
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              void handlePayment();
            }}
            disabled={processing}
            style={{
              ...styles.primaryButton,
              ...(processing ? styles.primaryButtonDisabled : {}),
            }}
          >
            {processing ? "Processing..." : "SEND PAYMENT"}
          </button>

          {message ? (
            <div
              style={{
                ...styles.message,
                ...(message.type === "success" ? styles.successBox : styles.errorBox),
              }}
            >
              {message.text}
            </div>
          ) : null}

          {successState ? (
            <div style={styles.successCard}>
              <div style={styles.successTitle}>✓ Payment Successful</div>
              <p style={styles.successText}>
                {formatCurrency(successState.amount)} sent to {successState.receiverUpiId}
              </p>
              <div style={styles.successMetaRow}>
                <span>Transaction ID:</span>
                <strong>{successState.transactionId}</strong>
              </div>
              <div style={styles.successMetaRow}>
                <span>Status:</span>
                <strong>{successState.status}</strong>
              </div>
              <div style={styles.successMetaRow}>
                <span>Remaining Balance:</span>
                <strong>{formatCurrency(successState.remainingBalance)}</strong>
              </div>
            </div>
          ) : null}
        </section>

        <section style={styles.historyCard}>
          <h2 style={styles.historyTitle}>Transaction History</h2>
          {history.length === 0 ? (
            <p style={styles.emptyText}>No recent transactions.</p>
          ) : (
            <div style={styles.historyList}>
              {history.map((item) => (
                <div key={item.id} style={styles.historyRow}>
                  <span style={styles.historyType}>{item.type}</span>
                  <span style={styles.historyAmount}>{formatCurrency(item.amount)}</span>
                  <span>{item.counterparty}</span>
                  <span>{item.method}</span>
                  <span style={item.status === "SUCCESS" ? styles.statusSuccess : styles.statusNeutral}>
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    background: "#f5f7fb",
    fontFamily: "Arial, sans-serif",
    color: "#1e293b",
    padding: "40px 20px",
  },
  container: {
    width: "100%",
    maxWidth: "960px",
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    margin: 0,
    fontSize: "2.6rem",
    fontWeight: 700,
  },
  card: {
    background: "#ffffff",
    borderRadius: "16px",
    padding: "22px 24px",
    boxShadow: "0 10px 25px rgba(15, 23, 42, 0.06)",
    border: "1px solid #e2e8f0",
  },
  formCard: {
    background: "#ffffff",
    borderRadius: "16px",
    padding: "22px 24px",
    boxShadow: "0 10px 25px rgba(15, 23, 42, 0.06)",
    border: "1px solid #e2e8f0",
  },
  historyCard: {
    background: "#ffffff",
    borderRadius: "16px",
    padding: "22px 24px",
    boxShadow: "0 10px 25px rgba(15, 23, 42, 0.06)",
    border: "1px solid #e2e8f0",
  },
  rowBetween: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    display: "block",
    marginBottom: "8px",
    fontWeight: 600,
    fontSize: "0.98rem",
  },
  balanceRow: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    marginTop: "16px",
    fontSize: "1.05rem",
  },
  balanceLabel: {
    fontWeight: 600,
  },
  select: {
    width: "100%",
    borderRadius: "10px",
    border: "1px solid #cbd5e1",
    padding: "12px 14px",
    fontSize: "1rem",
    background: "#fff",
    color: "#0f172a",
  },
  fieldRow: {
    display: "flex",
    flexDirection: "column",
    marginBottom: "18px",
  },
  input: {
    width: "100%",
    borderRadius: "10px",
    border: "1px solid #cbd5e1",
    padding: "12px 14px",
    fontSize: "1rem",
    boxSizing: "border-box",
  },
  radioGroup: {
    display: "flex",
    gap: "24px",
    alignItems: "center",
    marginTop: "2px",
    flexWrap: "wrap",
  },
  radioLabel: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontWeight: 500,
  },
  primaryButton: {
    width: "100%",
    border: "none",
    borderRadius: "12px",
    background: "#0f172a",
    color: "#ffffff",
    padding: "14px 20px",
    cursor: "pointer",
    fontSize: "1rem",
    fontWeight: 700,
    letterSpacing: "0.04em",
  },
  primaryButtonDisabled: {
    opacity: 0.7,
    cursor: "not-allowed",
  },
  message: {
    marginTop: "16px",
    borderRadius: "10px",
    padding: "12px 14px",
    fontWeight: 600,
  },
  successBox: {
    background: "#ecfdf5",
    color: "#065f46",
    border: "1px solid #a7f3d0",
  },
  errorBox: {
    background: "#fef2f2",
    color: "#991b1b",
    border: "1px solid #fecaca",
  },
  successCard: {
    marginTop: "18px",
    borderRadius: "12px",
    background: "#ecfdf5",
    border: "1px solid #a7f3d0",
    padding: "18px 16px",
    color: "#065f46",
  },
  successTitle: {
    fontSize: "1.3rem",
    fontWeight: 700,
    marginBottom: "8px",
  },
  successText: {
    margin: "0 0 12px",
    fontSize: "1.02rem",
  },
  successMetaRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    marginBottom: "8px",
    flexWrap: "wrap",
  },
  cardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(220px, 1fr))",
    gap: "18px",
  },
  historyTitle: {
    margin: "0 0 14px",
    fontSize: "1.2rem",
  },
  historyList: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  historyRow: {
    display: "grid",
    gridTemplateColumns: "1.2fr 1.1fr 1fr 1fr 0.8fr",
    gap: "12px",
    alignItems: "center",
    borderTop: "1px solid #e2e8f0",
    paddingTop: "10px",
    fontSize: "0.96rem",
  },
  historyType: {
    fontWeight: 600,
  },
  historyAmount: {
    fontWeight: 700,
  },
  statusSuccess: {
    color: "#047857",
    fontWeight: 700,
  },
  statusNeutral: {
    color: "#475569",
    fontWeight: 600,
  },
  emptyText: {
    margin: 0,
    color: "#64748b",
  },
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const __unusedStyles = styles;