import { importPKCS8, importSPKI, jwtVerify, SignJWT, type JWTPayload, type KeyLike } from "jose";

const ALG = "RS256";

export interface JwtKeyPair {
  privateKey: KeyLike;
  publicKey: KeyLike;
}

/** Loads a PEM keypair (as produced by scripts/gen-jwt-keys.ts) into jose KeyLike objects. */
export async function loadJwtKeys(privateKeyPem: string, publicKeyPem: string): Promise<JwtKeyPair> {
  const [privateKey, publicKey] = await Promise.all([
    importPKCS8(privateKeyPem, ALG),
    importSPKI(publicKeyPem, ALG),
  ]);
  return { privateKey, publicKey };
}

/** Signs a short-lived access token. `sub` + custom claims (role, districtId, etc.) go in payload. */
export async function signAccessToken(
  payload: JWTPayload,
  privateKey: KeyLike,
  ttlMinutes: number,
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${ttlMinutes}m`)
    .sign(privateKey);
}

/**
 * Verifies an access token. Explicitly allowlists RS256 (jose refuses to fall back to
 * "none" or a different alg even if the token header claims otherwise) — this is the
 * concrete defense against algorithm-confusion attacks that motivated choosing jose.
 */
export async function verifyAccessToken(token: string, publicKey: KeyLike): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, publicKey, { algorithms: [ALG] });
  return payload;
}
