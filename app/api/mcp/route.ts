/**
 * MCP endpoint for Claude Code: "Authorization: Bearer <MCP_TOKEN>".
 *   claude mcp add --transport http hrleaf https://<site>/api/mcp --header "Authorization: Bearer <MCP_TOKEN>"
 */

import { NextRequest } from "next/server";

import { mcpOther, mcpPost } from "@/server/mcp";

export const dynamic = "force-dynamic";

const auth = { kind: "header" } as const;

export const POST = (request: NextRequest) => mcpPost(request, auth);
export const GET = (request: NextRequest) => mcpOther(request, auth);
export const DELETE = (request: NextRequest) => mcpOther(request, auth);
