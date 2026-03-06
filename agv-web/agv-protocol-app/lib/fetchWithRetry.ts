// lib/fetchWithRetry.ts
export async function fetchWithRetry(url: string, init: RequestInit = {}, tries = 4) {
  let lastErr: any;
  for (let i = 0; i < tries; i++) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 10_000); // 10s timeout
    try {
      const res = await fetch(url, { ...init, signal: ctl.signal });
      clearTimeout(t);
      if (res.ok) return res;
      // Retry on 5xx
      if (res.status >= 500) throw new Error(`HTTP ${res.status}`);
      return res; // surface 4xx/etc
    } catch (e: any) {
      clearTimeout(t);
      lastErr = e;
      const msg = String(e?.message || "");
      const isDNS = msg.includes("EAI_AGAIN") || msg.includes("getaddrinfo");
      const isAbort = e?.name === "AbortError";
      if (i < tries - 1 && (isDNS || isAbort)) {
        const backoff = 300 * Math.pow(2, i) + Math.floor(Math.random() * 200);
        await new Promise(r => setTimeout(r, backoff));
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}
