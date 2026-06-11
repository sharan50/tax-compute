import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

// Must match OAUTH_STATE_COOKIE in client/src/const.ts
const OAUTH_STATE_COOKIE = "oauth_state";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

// The origin the callback is actually being served from, honouring the proxy
// header set by the deployment platform.
function getRequestOrigin(req: Request): string {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const proto =
    (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto)
      ?.split(",")[0]
      ?.trim() || req.protocol;
  const host = req.headers.host;
  return `${proto}://${host}`;
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    // ── Validate state before trusting any of it ────────────────────────
    let parsedState: { nonce: string; redirectUri: string };
    try {
      parsedState = sdk.parseState(state);
    } catch {
      res.status(400).json({ error: "invalid state" });
      return;
    }

    // CSRF guard (double-submit): the nonce embedded in `state` must match the
    // short-lived cookie planted when login began. A forged login won't have it.
    const cookies = parseCookieHeader(req.headers.cookie ?? "");
    const expectedNonce = cookies[OAUTH_STATE_COOKIE];
    if (!expectedNonce || expectedNonce !== parsedState.nonce) {
      res.status(403).json({ error: "state mismatch" });
      return;
    }

    // Open-redirect guard: the redirect target carried in `state` must point at
    // this same origin, not somewhere an attacker chose.
    const requestOrigin = getRequestOrigin(req);
    let redirectOrigin: string;
    try {
      redirectOrigin = new URL(parsedState.redirectUri).origin;
    } catch {
      res.status(400).json({ error: "invalid redirect target" });
      return;
    }
    if (redirectOrigin !== requestOrigin) {
      res.status(400).json({ error: "redirect origin mismatch" });
      return;
    }

    // One-time use: clear the nonce cookie now that it's been validated.
    res.clearCookie(OAUTH_STATE_COOKIE, { path: "/" });

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
