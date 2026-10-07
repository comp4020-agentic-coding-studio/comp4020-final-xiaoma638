// Run the production build over local HTTP. adapter-node 6 assumes HTTPS
// without a protocol header and no longer reads the ORIGIN environment var.
// Usage: pnpm build && pnpm preview (or PORT=8082 pnpm preview).
const host = process.env.HOST || "127.0.0.1";
const port = process.env.PORT || "8080";
if (!["127.0.0.1", "localhost", "::1"].includes(host)) {
  throw new Error("Local preview requires a loopback HOST. Use pnpm start with your production origin/proxy configuration for deployment.");
}

process.env.HOST = host;
process.env.PORT = port;
const protocolHeader = "x-srw-local-protocol";
process.env.PROTOCOL_HEADER = protocolHeader;
// Resolve at runtime: generated bundles are not source for type checking.
const { server } = await import(new URL("../build/index.js", import.meta.url).href);
// Supply the actual transport before adapter-node handles each request.
// Overwrite client input; the loopback HTTP listener is the authority here.
server.prependListener("request", /** @param {import('node:http').IncomingMessage} req */ (req) => {
  req.headers[protocolHeader] = "http";
});
