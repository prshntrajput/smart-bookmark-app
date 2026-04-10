import { NextRequest, NextResponse } from "next/server";
import type { UrlMetadata } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/fetch-metadata?url=https://example.com
//
// Why a server-side route and not a direct browser fetch?
//   Browsers block cross-origin requests to arbitrary sites (CORS).
//   Our Next.js server has no such restriction — it fetches on behalf
//   of the browser and returns only the metadata we need.
//
// Security:
//   SSRF prevention: we block private IPs and localhost so this
//   endpoint can't be abused to probe internal network services.
//
// Performance:
//   5-second timeout prevents this route from hanging indefinitely.
//   We only download the first 500KB of HTML — enough for <head>.
// ─────────────────────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 5_000;
const MAX_HTML_BYTES   = 500_000; // 500 KB — enough to cover <head>

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawUrl = searchParams.get("url");

  // ── 1. Validate input ───────────────────────────────────────────────────
  if (!rawUrl) {
    return NextResponse.json(
      { error: "Missing `url` query parameter." },
      { status: 400 }
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    return NextResponse.json(
      { error: "Invalid URL format." },
      { status: 400 }
    );
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    return NextResponse.json(
      { error: "Only http and https URLs are supported." },
      { status: 400 }
    );
  }

  // ── 2. SSRF guard ────────────────────────────────────────────────────────
  if (isPrivateHostname(parsedUrl.hostname)) {
    return NextResponse.json(
      { error: "Private/internal URLs are not allowed." },
      { status: 403 }
    );
  }

  // ── 3. Fetch the page ────────────────────────────────────────────────────
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let html: string;

  try {
    const response = await fetch(rawUrl, {
      signal: controller.signal,
      headers: {
        // Mimic a real browser — some sites block bot user-agents
        "User-Agent":
          "Mozilla/5.0 (compatible; SmartBookmark/1.0; +https://smartbookmark.app)",
        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Page returned ${response.status}.` },
        { status: 422 }
      );
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      // Non-HTML resource (PDF, image, etc.) — return URL hostname as title
      return NextResponse.json<UrlMetadata>({
        title:       parsedUrl.hostname,
        description: null,
        image:       null,
      });
    }

    // Stream only up to MAX_HTML_BYTES — avoids downloading huge pages
    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body.");

    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      totalBytes += value.length;
      if (totalBytes >= MAX_HTML_BYTES) {
        await reader.cancel();
        break;
      }
    }

    html = new TextDecoder("utf-8", { fatal: false }).decode(
      mergeUint8Arrays(chunks)
    );
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      return NextResponse.json(
        { error: "Request timed out. The page took too long to respond." },
        { status: 504 }
      );
    }
    return NextResponse.json(
      { error: "Could not fetch the page. Check the URL and try again." },
      { status: 422 }
    );
  } finally {
    clearTimeout(timer);
  }

  // ── 4. Parse metadata ────────────────────────────────────────────────────
  const metadata: UrlMetadata = {
    title:
      extractMetaProperty(html, "og:title") ??
      extractMetaName(html, "twitter:title") ??
      extractTitle(html),

    description:
      extractMetaProperty(html, "og:description") ??
      extractMetaName(html, "description") ??
      extractMetaName(html, "twitter:description"),

    image:
      extractMetaProperty(html, "og:image") ??
      extractMetaName(html, "twitter:image") ??
      null,
  };

  return NextResponse.json<UrlMetadata>(metadata);
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML parsing helpers (regex-based — no external dependency needed for <head>)
// ─────────────────────────────────────────────────────────────────────────────

/** Extract <meta property="og:title" content="..."> */
function extractMetaProperty(html: string, property: string): string | null {
  const escaped = property.replace(":", "\\:");
  const patterns = [
    new RegExp(
      `<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']+)["']`,
      "i"
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escaped}["']`,
      "i"
    ),
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m?.[1]) return decode(m[1].trim());
  }
  return null;
}

/** Extract <meta name="description" content="..."> */
function extractMetaName(html: string, name: string): string | null {
  const patterns = [
    new RegExp(
      `<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`,
      "i"
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`,
      "i"
    ),
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m?.[1]) return decode(m[1].trim());
  }
  return null;
}

/** Extract <title>...</title> */
function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i);
  return m?.[1] ? decode(m[1].trim()) : null;
}

/** Decode common HTML entities */
function decode(text: string): string {
  return text
    .replace(/&amp;/g,  "&")
    .replace(/&lt;/g,   "<")
    .replace(/&gt;/g,   ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g,  "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) =>
      String.fromCodePoint(parseInt(h, 16))
    )
    .replace(/&#([0-9]+);/g, (_, d) =>
      String.fromCodePoint(parseInt(d, 10))
    )
    .trim();
}

/** SSRF guard — block private/local hostnames */
function isPrivateHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h === "127.0.0.1" || h === "0.0.0.0") return true;
  if (/^10\./.test(h))                              return true;
  if (/^192\.168\./.test(h))                        return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h))        return true;
  if (h === "::1" || h === "fe80::1")               return true;
  return false;
}

/** Merge Uint8Array chunks into one */
function mergeUint8Arrays(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out   = new Uint8Array(total);
  let offset  = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}