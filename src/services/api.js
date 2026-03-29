// ─── API SERVICE WITH RETRY ──────────────────────────────────────────────────

/**
 * Fetch with exponential backoff retry and timeout support.
 * Returns { data, error } — never throws.
 */
export async function fetchWithRetry(url, options = {}, retries = 2) {
  const timeout = options.timeout || 10000;
  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        lastError = new Error(`API ${response.status}: ${errorBody || response.statusText}`);
        if (attempt < retries) {
          await delay(getBackoffMs(attempt));
          continue;
        }
        return { data: null, error: lastError.message };
      }

      const data = await response.json();

      if (data.error) {
        return { data: null, error: data.error.message || String(data.error) };
      }

      return { data, error: null };
    } catch (err) {
      lastError = err;
      if (err.name === "AbortError") {
        lastError = new Error("La solicitud excedio el tiempo limite");
      }
      if (attempt < retries) {
        await delay(getBackoffMs(attempt));
        continue;
      }
    }
  }

  return { data: null, error: lastError?.message || "Error desconocido" };
}

function getBackoffMs(attempt) {
  return Math.pow(2, attempt) * 1000; // 1s, 2s
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
