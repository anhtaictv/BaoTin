import { generateKeyPairSync } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const keysDir = join(process.cwd(), "keys");
const privatePath = join(keysDir, "jwt-private.pem");
const publicPath = join(keysDir, "jwt-public.pem");

if (existsSync(privatePath) || existsSync(publicPath)) {
  console.log("backend/keys/jwt-*.pem already exist — skipping. Delete them first to regenerate.");
  process.exit(0);
}

mkdirSync(keysDir, { recursive: true });

const { publicKey, privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

writeFileSync(privatePath, privateKey, { mode: 0o600 });
writeFileSync(publicPath, publicKey, { mode: 0o644 });

console.log(`Generated RS256 dev keypair:\n  ${privatePath}\n  ${publicPath}`);
console.log("These are gitignored — never commit them, and generate a fresh pair per environment.");
