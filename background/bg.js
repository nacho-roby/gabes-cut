const CACHE_KEY = 'boxleiter_gamalytic_cache';
const PRICE_CACHE_KEY = 'boxleiter_us_price_cache';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

async function getStored(keys) {
  return new Promise(resolve => chrome.storage.local.get(keys, resolve));
}

async function setStored(obj) {
  return new Promise(resolve => chrome.storage.local.set(obj, resolve));
}

async function readCache(appId) {
  const stored = await getStored([CACHE_KEY]);
  const cache = stored[CACHE_KEY] || {};
  const entry = cache[appId];
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) return null;
  return entry;
}

async function writeCache(appId, data) {
  const stored = await getStored([CACHE_KEY]);
  const cache = stored[CACHE_KEY] || {};
  cache[appId] = { data, timestamp: Date.now() };
  await setStored({ [CACHE_KEY]: cache });
}

async function readPriceCache(appId) {
  const stored = await getStored([PRICE_CACHE_KEY]);
  const cache = stored[PRICE_CACHE_KEY] || {};
  const entry = cache[appId];
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) return null;
  return entry;
}

async function writePriceCache(appId, payload) {
  const stored = await getStored([PRICE_CACHE_KEY]);
  const cache = stored[PRICE_CACHE_KEY] || {};
  cache[appId] = { ...payload, timestamp: Date.now() };
  await setStored({ [PRICE_CACHE_KEY]: cache });
}

async function fetchUsPriceFromSteam(appId) {
  const url = `https://store.steampowered.com/api/appdetails?appids=${encodeURIComponent(appId)}&cc=us&filters=price_overview`;
  let res;
  try {
    // credentials: 'omit' avoids sending Steam login cookies, which would force
    // a CORS preflight that Steam's appdetails endpoint doesn't satisfy.
    res = await fetchWithTimeout(url, {
      headers: { accept: 'application/json' },
      credentials: 'omit',
    });
  } catch (e) {
    console.warn('[Boxleiter] Steam fetch network error:', e);
    throw new Error(`network error: ${e?.message || e}`);
  }
  if (!res.ok) {
    console.warn('[Boxleiter] Steam appdetails non-OK:', res.status, res.statusText);
    throw new Error(`Steam appdetails returned HTTP ${res.status}`);
  }
  let json;
  try {
    json = await res.json();
  } catch (e) {
    console.warn('[Boxleiter] Steam response not JSON:', e);
    throw new Error(`Steam response not JSON: ${e?.message || e}`);
  }
  const entry = json && json[appId];
  if (!entry) {
    console.warn('[Boxleiter] Steam response missing app entry:', json);
    throw new Error('No entry in Steam appdetails response');
  }
  if (entry.success === false) return { amount: 0, currency: 'USD', source: 'steam-us', isFree: true };
  const overview = entry.data && entry.data.price_overview;
  if (!overview) {
    return { amount: 0, currency: 'USD', source: 'steam-us', isFree: true };
  }
  return {
    amount: overview.initial / 100,
    currency: overview.currency || 'USD',
    source: 'steam-us',
    isFree: false,
  };
}

async function fetchUsPriceFromGamalyticCache(appId) {
  const stored = await getStored([CACHE_KEY]);
  const cache = stored[CACHE_KEY] || {};
  const entry = cache[appId];
  if (!entry || !entry.data) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) return null;
  if (typeof entry.data.price !== 'number') return null;
  return {
    amount: entry.data.price,
    currency: 'USD',
    source: 'gamalytic-cache',
    isFree: entry.data.price === 0,
  };
}

async function getUsPrice(appId, force) {
  if (!force) {
    const cached = await readPriceCache(appId);
    if (cached) return { ok: true, ...cached, cached: true };
  }
  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const price = await fetchUsPriceFromSteam(appId);
      await writePriceCache(appId, price);
      return { ok: true, ...price, cached: false };
    } catch (e) {
      lastError = e;
      console.warn(`[Boxleiter] Steam attempt ${attempt + 1} failed:`, e?.message || e);
    }
  }
  // Both attempts failed — try Gamalytic cache as last resort.
  const fromGamalytic = await fetchUsPriceFromGamalyticCache(appId);
  if (fromGamalytic) {
    console.info('[Boxleiter] Falling back to cached Gamalytic price for', appId);
    return { ok: true, ...fromGamalytic, cached: false, steamError: String(lastError?.message || lastError) };
  }
  console.error('[Boxleiter] All US-price sources failed for', appId, lastError);
  return { ok: false, error: String(lastError?.message || lastError) };
}

function fetchWithTimeout(url, options = {}, ms = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

async function fetchGamalytic(appId) {
  const url = `https://gamalytic.com/api/game-details/${encodeURIComponent(appId)}`;
  let res;
  try {
    res = await fetchWithTimeout(url, {
      headers: { accept: 'application/json' },
      credentials: 'omit',
    });
  } catch (e) {
    console.warn('[Boxleiter] Gamalytic fetch network error:', e);
    if (e?.name === 'AbortError') throw new Error('Gamalytic request timed out');
    throw new Error(`network error: ${e?.message || e}`);
  }
  if (res.status === 404) throw new Error('Game not found on Gamalytic');
  if (res.status === 429) throw new Error('Gamalytic rate-limited the request. Try again in a bit.');
  if (!res.ok) throw new Error(`Gamalytic returned HTTP ${res.status}`);
  const json = await res.json();
  if (!json || !json.data) throw new Error('Empty response from Gamalytic');
  return json.data;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg) return undefined;

  if (msg.type === 'usPriceFetch') {
    (async () => {
      try {
        const { appId, force } = msg;
        if (!appId) {
          sendResponse({ ok: false, error: 'Missing appId' });
          return;
        }
        const result = await getUsPrice(appId, force);
        sendResponse(result);
      } catch (e) {
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
    })();
    return true;
  }

  if (msg.type === 'gamalyticFetch') {
    (async () => {
      try {
        const { appId, force } = msg;
        if (!appId) {
          sendResponse({ ok: false, error: 'Missing appId' });
          return;
        }
        if (!force) {
          const cached = await readCache(appId);
          if (cached) {
            sendResponse({ ok: true, data: cached.data, cached: true, timestamp: cached.timestamp });
            return;
          }
        }
        const data = await fetchGamalytic(appId);
        await writeCache(appId, data);
        sendResponse({ ok: true, data, cached: false, timestamp: Date.now() });
      } catch (e) {
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
    })();
    return true;
  }

  return undefined;
});
