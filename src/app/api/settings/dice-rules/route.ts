import { NextResponse } from "next/server";
import { diceRulesConfigSchema } from "@/lib/validation/schemas";
import {
  getDiceRulesConfig,
  resetDiceRulesConfig,
  setDiceRulesConfig,
} from "@/lib/settings/diceRulesService";

export async function GET() {
  const config = await getDiceRulesConfig();
  return NextResponse.json({ config });
}

export async function PUT(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid request body." } },
      { status: 400 },
    );
  }

  const parsed = diceRulesConfigSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: parsed.error.issues[0]?.message ?? "Invalid settings.",
        },
      },
      { status: 400 },
    );
  }

  const config = await setDiceRulesConfig(parsed.data);
  return NextResponse.json({ config });
}

export async function DELETE() {
  const config = await resetDiceRulesConfig();
  return NextResponse.json({ config });
}
