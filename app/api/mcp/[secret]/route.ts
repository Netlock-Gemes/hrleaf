/**
 * MCP endpoint with the secret in the address, for clients that can't send an
 * Authorization header: claude.ai custom connectors (and so the Claude mobile
 * apps). Add https://<site>/api/mcp/<MCP_URL_SECRET> as a connector with no login.
 * Anyone with this address can write notes: keep it private, change it if it leaks.
 */

import { NextRequest } from "next/server";

import { mcpOther, mcpPost } from "@/server/mcp";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ secret: string }> };

const auth = async ({ params }: Params) => ({ kind: "path", given: (await params).secret }) as const;

export const POST = async (request: NextRequest, ctx: Params) => mcpPost(request, await auth(ctx));
export const GET = async (request: NextRequest, ctx: Params) => mcpOther(request, await auth(ctx));
export const DELETE = async (request: NextRequest, ctx: Params) => mcpOther(request, await auth(ctx));
