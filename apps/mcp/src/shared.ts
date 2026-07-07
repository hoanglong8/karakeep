import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import TurndownService from "turndown";

import { createKarakeepClient } from "@karakeep/sdk";

const addr = process.env.KARAKEEP_API_ADDR;
const apiKey = process.env.KARAKEEP_API_KEY;

const getCustomHeaders = () => {
  try {
    return process.env.KARAKEEP_CUSTOM_HEADERS
      ? JSON.parse(process.env.KARAKEEP_CUSTOM_HEADERS)
      : {};
  } catch (e) {
    console.error("Failed to parse KARAKEEP_CUSTOM_HEADERS", e);
    return {};
  }
};

const apiHeaders = {
  ...getCustomHeaders(),
  "Content-Type": "application/json",
  authorization: `Bearer ${apiKey}`,
};

export const karakeepClient = createKarakeepClient({
  baseUrl: `${addr}/api/v1`,
  headers: apiHeaders,
});

// Plain fetch for endpoints not yet part of the generated SDK types.
export async function fetchApi(
  path: string,
  init?: RequestInit,
): Promise<{ data?: unknown; error?: unknown; status: number }> {
  const res = await fetch(`${addr}/api/v1${path}`, {
    ...init,
    headers: { ...apiHeaders, ...init?.headers },
  });
  const body = await res.json().catch(() => undefined);
  if (!res.ok) {
    return { error: body, status: res.status };
  }
  return { data: body, status: res.status };
}

export const mcpServer = new McpServer({
  name: "Karakeep",
  version: "0.23.0",
});

export const turndownService = new TurndownService();
