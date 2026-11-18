#!/usr/bin/env node
/**
 * Generates the RS256 key pair Convex Auth uses to sign session JWTs and
 * stores it on the current Convex deployment (JWT_PRIVATE_KEY + JWKS).
 *
 *   npm run auth:keys            # dev deployment (from .env.local)
 *   npm run auth:keys -- --prod  # production deployment
 *
 * Run once per deployment. Re-running rotates the keys and signs everyone out.
 */
import { spawnSync } from "node:child_process";
import { exportJWK, exportPKCS8, generateKeyPair } from "jose";

const extra = process.argv.slice(2);

const keys = await generateKeyPair("RS256", { extractable: true });
const privateKey = await exportPKCS8(keys.privateKey);
const publicKey = await exportJWK(keys.publicKey);
const jwks = JSON.stringify({ keys: [{ use: "sig", ...publicKey }] });

function setEnv(name, value) {
  // Args array (no shell), and "--" so the PEM's leading dashes aren't read as a flag.
  const res = spawnSync("npx", ["convex", "env", "set", ...extra, name, "--", value], {
    stdio: ["ignore", "inherit", "inherit"],
  });
  if (res.status !== 0) {
    console.error(`Failed to set ${name}`);
    process.exit(res.status ?? 1);
  }
}

setEnv("JWT_PRIVATE_KEY", privateKey.trimEnd().replace(/\n/g, " "));
setEnv("JWKS", jwks);
console.log("✔ Convex Auth keys set.");
