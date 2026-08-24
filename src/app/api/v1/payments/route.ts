import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import {
  PaymentError,
  createPaymentService,
  createPrismaPaymentStore,
} from "../../../../modules/payments/payment.service";

const paymentService = createPaymentService(createPrismaPaymentStore(prisma));

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const idempotencyKey = request.headers.get("Idempotency-Key") ?? undefined;
    const result = await paymentService(
      body,
      idempotencyKey ? { idempotencyKey } : undefined,
    );

    return NextResponse.json(
      { success: true, data: result.payment },
      { status: result.idempotentReplay ? 200 : 201 },
    );
  } catch (error) {
    if (error instanceof PaymentError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status },
      );
    }

    console.error(error);

    return NextResponse.json(
      { success: false, error: "Failed to process payment" },
      { status: 500 },
    );
  }
}
