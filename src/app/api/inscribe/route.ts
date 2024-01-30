import { NextRequest, NextResponse } from "next/server";
import { Metadata } from "@/contracts/types/metadata";
import { engine } from "@/lambda/engine";
import { Inscription } from "@/inscription";
import { randomInt } from "node:crypto";

export async function POST(request: NextRequest) {
  const { inscription, block, sender } = await request.json();
  console.log(inscription, block, sender);
  const ins = JSON.parse(inscription) as Inscription;
  const metadata = {
    sender: sender,
    origin: sender,
    timestamp: 0,
    transactionHash: randomInt(100000).toString(),
    blockNumber: block,
    currentContract: "",
  } satisfies Metadata;
  await engine(ins, metadata);

  return new NextResponse("ok");
}
