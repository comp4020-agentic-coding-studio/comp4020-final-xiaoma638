import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    baseUrl: string;
    protocolHeader: string;
  }
}

// The spec checks a RUNNING app over HTTP, so it holds whatever the app is
// built with. CI builds the Dockerfile, starts the image and points APP_URL
// at it, so what passes there is what deploys. Locally, start your app however
// you run it, then `pnpm check`; APP_URL says where it's listening. It waits
// up to a minute, since some stacks take a while to boot or migrate.
export default async function setup(project: TestProject): Promise<void> {
  const baseUrl = process.env.APP_URL ?? "http://localhost:8080";
  // The Docker test run takes the place of Fly's trusted reverse proxy.
  // Direct local-preview checks must leave this unset so a missing server
  // protocol configuration remains visible in the cookie regression test.
  const protocolHeader = process.env.APP_PROTOCOL_HEADER?.trim() ?? "";
  const headers = protocolHeader ? { [protocolHeader]: new URL(baseUrl).protocol.slice(0, -1) } : {};

  for (let attempt = 0; ; attempt++) {
    try {
      await fetch(baseUrl, { headers });
      break;
    } catch {
      // not up yet
    }
    if (attempt >= 300) {
      throw new Error(
        `nothing is answering at ${baseUrl}: start your app first, or set APP_URL to where it's listening`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  project.provide("baseUrl", baseUrl);
  project.provide("protocolHeader", protocolHeader);
}
