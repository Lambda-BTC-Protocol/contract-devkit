import { NextRequest, NextResponse } from "next/server";
import { Query } from "@/Query";
import { bigIntJson } from "@/lib/big-int";
import { persistenceStorage } from "@/persistenceStorage";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const contract = params.get("contract");
  const func = params.get("function");
  const args = params.get("args");
  console.log(contract, "contract>>>>>>>>>", persistenceStorage);

  if (!contract || !func || !args)
    return new NextResponse("missing params", { status: 400 });

  const query = new Query();
  try {
    const result = await query.execute(contract, func, bigIntJson.parse(args));
    console.log(result, "result");
    return new NextResponse(bigIntJson.stringify(result));
  } catch (e) {
    console.log(e, "queryError");
    return new NextResponse("missing params", { status: 400 });
  }
}
