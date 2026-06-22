const DEFAULT_ALLOWED_ORIGINS = [
  "https://www.quickadmissiongh.com",
  "https://quickadmissiongh.com",
  "http://127.0.0.1",
  "http://localhost",
  "http://127.0.0.1:3000",
  "http://localhost:3000",
  "http://127.0.0.1:4173",
  "http://localhost:4173",
  "http://127.0.0.1:5173",
  "http://localhost:5173",
  "http://127.0.0.1:5500",
  "http://localhost:5500",
  "http://127.0.0.1:8080",
  "http://localhost:8080",
];

type SecurityOptions = {
  allowNullOrigin?: boolean;
  allowedOrigins?: string[];
  maxBodyBytes?: number;
  methods?: string[];
};

function normalizeOrigin(origin: string) {
  return origin.trim().replace(/\/+$/, "");
}

function parseAllowedOrigins(extra: string[] = []) {
  const fromEnv = String(Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((value) => normalizeOrigin(value))
    .filter(Boolean);
  return new Set([
    ...DEFAULT_ALLOWED_ORIGINS,
    ...fromEnv,
    ...extra.map((value) => normalizeOrigin(value)).filter(Boolean),
  ]);
}

function allowedOriginValue(origin: string | null, options: SecurityOptions = {}) {
  if (!origin) return "*";
  const normalized = normalizeOrigin(origin);
  if (normalized === "null") {
    return options.allowNullOrigin === false ? "" : "null";
  }
  const allowedOrigins = parseAllowedOrigins(options.allowedOrigins ?? []);
  return allowedOrigins.has(normalized) ? normalized : "";
}

export function corsHeaders(req: Request, options: SecurityOptions = {}) {
  const allowOrigin = allowedOriginValue(req.headers.get("Origin"), options);
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": (options.methods ?? ["POST", "OPTIONS"]).join(", "),
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
  if (allowOrigin) headers["Access-Control-Allow-Origin"] = allowOrigin;
  return headers;
}

export function jsonResponse(
  req: Request,
  body: unknown,
  status = 200,
  options: SecurityOptions = {},
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(req, options),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export function guardRequest(req: Request, options: SecurityOptions = {}) {
  const methods = options.methods ?? ["POST", "OPTIONS"];
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req, options) });
  }

  const origin = req.headers.get("Origin");
  if (origin && !allowedOriginValue(origin, options)) {
    return jsonResponse(
      req,
      { ok: false, error: "origin_forbidden", message: "Origin is not allowed." },
      403,
      options,
    );
  }

  if (!methods.includes(req.method)) {
    return jsonResponse(
      req,
      { ok: false, error: "method_not_allowed", message: "Method not allowed." },
      405,
      options,
    );
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    const contentType = String(req.headers.get("content-type") ?? "").toLowerCase();
    if (!contentType.includes("application/json")) {
      return jsonResponse(
        req,
        { ok: false, error: "unsupported_media_type", message: "Requests must use application/json." },
        415,
        options,
      );
    }

    const contentLength = Number(req.headers.get("content-length") ?? "0");
    if (
      options.maxBodyBytes &&
      Number.isFinite(contentLength) &&
      contentLength > 0 &&
      contentLength > options.maxBodyBytes
    ) {
      return jsonResponse(
        req,
        { ok: false, error: "payload_too_large", message: "Request body is too large." },
        413,
        options,
      );
    }
  }

  return null;
}
