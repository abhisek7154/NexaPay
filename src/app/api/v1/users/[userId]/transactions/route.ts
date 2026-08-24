import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../../lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const { userId } = await params;

    const transactions = await prisma.transaction.findMany({
      orderBy: { createdAt: "desc" },
      take: 25,
    });

    const userTransactions = transactions
      .map((transaction: { id: string; amount: number; status: string; metadata: string | null }) => {
        const metadata = safeParseMetadata(transaction.metadata);
        const senderId = metadata?.senderId;
        const receiverId = metadata?.receiverId;

        if (senderId !== userId && receiverId !== userId) {
          return null;
        }

        const type = senderId === userId ? "Sent" : "Received";
        const counterparty =
          senderId === userId
            ? metadata?.receiverName ?? "Receiver"
            : metadata?.senderName ?? "Sender";
        const method = metadata?.paymentMethod === "CARD" ? "CARD" : "UPI";
        const status = transaction.status === "SETTLED" ? "SUCCESS" : transaction.status;

        return {
          id: transaction.id,
          type,
          amount: Number(transaction.amount ?? 0),
          counterparty,
          method,
          status,
        };
      })
      .filter(
        (item: { id: string; type: string; amount: number; counterparty: string; method: string; status: string } | null): item is { id: string; type: string; amount: number; counterparty: string; method: string; status: string } => Boolean(item),
      );

    return NextResponse.json({ success: true, transactions: userTransactions });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, error: "Failed to load transactions" },
      { status: 500 },
    );
  }
}

function safeParseMetadata(metadata: string | null) {
  if (!metadata) {
    return null;
  }

  try {
    return JSON.parse(metadata) as {
      senderId?: string;
      receiverId?: string;
      receiverName?: string;
      senderName?: string;
      paymentMethod?: string;
    };
  } catch {
    return null;
  }
}
