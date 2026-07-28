import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { createDetectorApiKeyMiddleware } from "./detectorApiKey.js";
import { HttpError } from "./errorHandler.js";

function fakeReq(headerValue?: string | string[]): Request {
  return { headers: { "x-detector-api-key": headerValue } } as unknown as Request;
}

describe("detectorApiKey middleware", () => {
  it("calls next() with no error when the key matches exactly", () => {
    const middleware = createDetectorApiKeyMiddleware("secret-key");
    const next = vi.fn();
    middleware(fakeReq("secret-key"), {} as Response, next);
    expect(next).toHaveBeenCalledWith();
  });

  it("rejects with 401 when the key is wrong", () => {
    const middleware = createDetectorApiKeyMiddleware("secret-key");
    const next = vi.fn();
    middleware(fakeReq("wrong-key"), {} as Response, next);
    expect(next).toHaveBeenCalledWith(expect.any(HttpError));
    expect((next.mock.calls[0]?.[0] as HttpError).status).toBe(401);
  });

  it("rejects with 401 when the key differs only in length", () => {
    const middleware = createDetectorApiKeyMiddleware("secret-key");
    const next = vi.fn();
    middleware(fakeReq("secret-key-longer"), {} as Response, next);
    expect((next.mock.calls[0]?.[0] as HttpError).status).toBe(401);
  });

  it("rejects with 401 when the header is missing", () => {
    const middleware = createDetectorApiKeyMiddleware("secret-key");
    const next = vi.fn();
    middleware(fakeReq(undefined), {} as Response, next);
    expect((next.mock.calls[0]?.[0] as HttpError).status).toBe(401);
  });

  it("rejects with 401 when the header is sent twice (array value)", () => {
    const middleware = createDetectorApiKeyMiddleware("secret-key");
    const next = vi.fn();
    middleware(fakeReq(["secret-key", "secret-key"]), {} as Response, next);
    expect((next.mock.calls[0]?.[0] as HttpError).status).toBe(401);
  });

  it("rejects everything when expectedKey is not configured (empty string)", () => {
    const middleware = createDetectorApiKeyMiddleware("");
    const next = vi.fn();
    middleware(fakeReq("anything"), {} as Response, next);
    expect((next.mock.calls[0]?.[0] as HttpError).status).toBe(401);
  });
});
