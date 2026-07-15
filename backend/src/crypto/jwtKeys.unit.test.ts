import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { exportPKCS8, exportSPKI, SignJWT } from "jose";
import { loadJwtKeys, signAccessToken, verifyAccessToken } from "./jwtKeys.js";

async function freshPemKeypair() {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  return {
    privateKeyPem: await exportPKCS8(privateKey as never),
    publicKeyPem: await exportSPKI(publicKey as never),
  };
}

describe("jwtKeys", () => {
  it("signs and verifies an access token round trip, preserving custom claims", async () => {
    const { privateKeyPem, publicKeyPem } = await freshPemKeypair();
    const { privateKey, publicKey } = await loadJwtKeys(privateKeyPem, publicKeyPem);

    const token = await signAccessToken({ sub: "user-123", role: "citizen" }, privateKey, 20);
    const payload = await verifyAccessToken(token, publicKey);

    expect(payload.sub).toBe("user-123");
    expect(payload.role).toBe("citizen");
    expect(payload.exp).toBeDefined();
  });

  it("rejects a token signed by a different keypair", async () => {
    const pairA = await freshPemKeypair();
    const pairB = await freshPemKeypair();
    const keysA = await loadJwtKeys(pairA.privateKeyPem, pairA.publicKeyPem);
    const keysB = await loadJwtKeys(pairB.privateKeyPem, pairB.publicKeyPem);

    const token = await signAccessToken({ sub: "user-123" }, keysA.privateKey, 20);
    await expect(verifyAccessToken(token, keysB.publicKey)).rejects.toThrow();
  });

  it("rejects an expired token", async () => {
    const { privateKeyPem, publicKeyPem } = await freshPemKeypair();
    const { privateKey, publicKey } = await loadJwtKeys(privateKeyPem, publicKeyPem);

    const expired = await new SignJWT({ sub: "user-123" })
      .setProtectedHeader({ alg: "RS256" })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 1800)
      .sign(privateKey);

    await expect(verifyAccessToken(expired, publicKey)).rejects.toThrow();
  });

  it("rejects a token whose header claims a different algorithm (alg-confusion defense)", async () => {
    const { privateKeyPem, publicKeyPem } = await freshPemKeypair();
    const { publicKey } = await loadJwtKeys(privateKeyPem, publicKeyPem);
    // An HS256 token "signed" using the RSA public key's bytes as an HMAC secret is the
    // classic alg-confusion attack shape. jose's algorithms allowlist in verifyAccessToken
    // must refuse it outright rather than trying to validate it as HS256.
    const forged = await new SignJWT({ sub: "attacker" })
      .setProtectedHeader({ alg: "HS256" })
      .sign(new TextEncoder().encode("any-secret-at-all"));

    await expect(verifyAccessToken(forged, publicKey)).rejects.toThrow();
  });
});
