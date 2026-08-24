import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../lib/prisma";

const schema = z.object({
  merchantId: z.string().min(1),
  paymentMethodId: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().length(3),
  idempotencyKey: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = schema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: "Invalid transaction data" },
        { status: 400 }
      );
    }

    const transaction = await prisma.transaction.create({
      data: {
        merchantId: result.data.merchantId,
        paymentMethodId: result.data.paymentMethodId,
        amount: result.data.amount,
        currency: result.data.currency,
        idempotencyKey: result.data.idempotencyKey,
        referenceId: `TXN-${Date.now()}`,
        status: "PENDING",
      },
    });

    return NextResponse.json(
      { success: true, data: transaction },
      { status: 201 }
    );
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { success: false, error: "Failed to create transaction" },
      { status: 500 }
    );
  }
}