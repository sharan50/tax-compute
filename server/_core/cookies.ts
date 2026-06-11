import type { CookieOptions, Request } from "express";

const isProduction = process.env.NODE_ENV === "production";

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");

  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  // `sameSite: "lax"` lets the cookie ride along on top-level navigations
  // (so the OAuth redirect back to the app keeps the session) while blocking
  // it on cross-site sub-requests — the CSRF protection `none` was giving up.
  //
  // `secure` is always true in production so the session cookie is never sent
  // over plain HTTP. In development we honour the actual request protocol so
  // local http://localhost still works.
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: isProduction ? true : isSecureRequest(req),
  };
}
