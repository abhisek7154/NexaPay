import { NextRequest } from "next/server";
import { prisma } from "../lib/prisma";

export async function authenticate(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key");

  if (!apiKey) {
    return null;
  }

  return prisma.merchant.findUnique({
    where: { apiKey },
  });
}