import { NextRequest, NextResponse } from "next/server";
import { Query } from "@/Query";
import { bigIntJson } from "@/lib/big-int";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const contract = params.get("contract");
  const func = params.get("function");
  const args = params.get("args");

  if (!contract || !func || !args)
    return new NextResponse("missing params", { status: 400 });

  const query = new Query();
  const result = await query.execute(contract, func, bigIntJson.parse(args));
  return new NextResponse(bigIntJson.stringify(result));
}
