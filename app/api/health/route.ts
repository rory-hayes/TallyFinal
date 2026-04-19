import { NextResponse } from "next/server";

import {
  createServiceStatusSnapshot,
  readAppEnvironment,
} from "@/lib/env";

export async function GET() {
  const environment = readAppEnvironment();

  return NextResponse.json({
    ok: true,
    appName: environment.appName,
    services: createServiceStatusSnapshot(environment),
  });
}
