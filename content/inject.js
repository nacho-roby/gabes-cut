(function () {
  const { calc, parser } = window.Boxleiter;

  const STORAGE_KEY = 'boxleiter_settings';
  const REVIEW_OVERRIDE_KEY = 'boxleiter_review_overrides';
  const PRICE_OVERRIDE_KEY = 'boxleiter_price_overrides';
  const DEFAULT_SETTINGS = {
    avgDiscount: calc.DEDUCTIONS.averageDiscount,
    refunds: calc.DEDUCTIONS.refunds,
  };
  const RANGES = {
    avgDiscount: { min: 0, max: 50 },
    refunds:     { min: 0, max: 20 },
  };

  function getAppId() {
    const m = location.pathname.match(/\/app\/(\d+)/);
    return m ? m[1] : null;
  }

  function fetchUsPrice(appId, force = false) {
    return new Promise(resolve => {
      if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
        resolve({ ok: false, error: 'Extension runtime unavailable' });
        return;
      }
      chrome.runtime.sendMessage({ type: 'usPriceFetch', appId, force }, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message });
          return;
        }
        resolve(response || { ok: false, error: 'No response from background' });
      });
    });
  }

  function fetchGamalytic(appId, force = false) {
    return new Promise(resolve => {
      if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
        resolve({ ok: false, error: 'Extension runtime unavailable' });
        return;
      }
      chrome.runtime.sendMessage({ type: 'gamalyticFetch', appId, force }, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message });
          return;
        }
        resolve(response || { ok: false, error: 'No response from background' });
      });
    });
  }

  function fmtAge(ts) {
    const diff = Date.now() - ts;
    const h = Math.floor(diff / 3600000);
    if (h < 1) {
      const m = Math.floor(diff / 60000);
      return m <= 0 ? 'just now' : `${m}m ago`;
    }
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  function loadSettings() {
    return new Promise(resolve => {
      if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
        resolve({ ...DEFAULT_SETTINGS });
        return;
      }
      chrome.storage.local.get([STORAGE_KEY], (result) => {
        const stored = (result && result[STORAGE_KEY]) || {};
        resolve({ ...DEFAULT_SETTINGS, ...stored });
      });
    });
  }

  function saveSettings(settings) {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;
    chrome.storage.local.set({ [STORAGE_KEY]: settings });
  }

  function loadOverride(key, appId) {
    return new Promise(resolve => {
      if (!appId || typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
        resolve(null);
        return;
      }
      chrome.storage.local.get([key], (result) => {
        const map = (result && result[key]) || {};
        const v = map[appId];
        resolve(typeof v === 'number' && v > 0 ? v : null);
      });
    });
  }

  function saveOverride(key, appId, value) {
    if (!appId || typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;
    chrome.storage.local.get([key], (result) => {
      const map = (result && result[key]) || {};
      if (value == null) delete map[appId];
      else map[appId] = value;
      chrome.storage.local.set({ [key]: map });
    });
  }

  const loadReviewOverride = (appId) => loadOverride(REVIEW_OVERRIDE_KEY, appId);
  const saveReviewOverride = (appId, value) => saveOverride(REVIEW_OVERRIDE_KEY, appId, value);
  const loadPriceOverride = (appId) => loadOverride(PRICE_OVERRIDE_KEY, appId);
  const savePriceOverride = (appId, value) => saveOverride(PRICE_OVERRIDE_KEY, appId, value);

  function fmtNum(n) {
    if (n == null || Number.isNaN(n)) return '-';
    return Math.round(n).toLocaleString('en-US');
  }

  function fmtMoney(n, currency) {
    return `${currency}${fmtNum(n)}`;
  }

  function fmtPrice(n, currency) {
    // Keep cents for the base price label; large revenue numbers still use fmtMoney (rounded).
    if (n == null || Number.isNaN(n)) return '-';
    const fixed = Number.isInteger(n) ? `${n}.00` : n.toFixed(2);
    return `${currency}${fixed}`;
  }

  function buildPanel({ title, reviews, price, detected, override, detectedPrice, priceOverride, appId }, settings) {
    const wrapper = document.createElement('div');
    wrapper.className = 'boxleiter-panel';
    wrapper.id = 'boxleiter-panel';

    if (reviews == null) {
      wrapper.innerHTML = `
        <div class="bx-header">💰 Gabe's Cut</div>
        <div class="bx-empty">Couldn't detect the review count on this page. Steam may be hiding it under language/region filters — try the "All Languages" filter on the reviews block.</div>`;
      return wrapper;
    }

    if (reviews === 0) {
      wrapper.innerHTML = `
        <div class="bx-header">💰 Gabe's Cut</div>
        <div class="bx-empty">No reviews yet — can't estimate.</div>`;
      return wrapper;
    }

    let currentReviews = reviews;
    let currentReviewOverride = override;
    const isFree = !price || price.amount === 0;
    const currency = price ? price.currency : '$';
    let currentPrice = price ? price.amount : 0;
    let currentPriceOverride = priceOverride;
    const priceSource = price ? price.source : null;
    const baseLabel = priceSource === 'steam-us' ? 'Base price (US)'
      : priceSource === 'gamalytic-cache' ? 'Base price (Gamalytic)'
      : 'Base price';
    const priceLabelFor = (hasOverride) => hasOverride ? 'Base price (manual)' : baseLabel;
    const usingRegionalFallback = priceSource === 'dom-regional';

    const current = { ...settings };

    const slider = (key, label) => {
      const r = RANGES[key];
      const pct = Math.round(current[key] * 100);
      return `
        <div class="bx-control">
          <label class="bx-control-label" for="bx-${key}-num">${label}</label>
          <input type="range" class="bx-slider" id="bx-${key}-slider"
                 min="${r.min}" max="${r.max}" step="1" value="${pct}">
          <div class="bx-num-wrap">
            <input type="number" class="bx-num-input" id="bx-${key}-num"
                   min="${r.min}" max="${r.max}" step="1" value="${pct}">
            <span class="bx-pct">%</span>
          </div>
        </div>`;
    };

    wrapper.innerHTML = `
      <div class="bx-header">💰 Gabe's Cut</div>
      <div class="bx-meta">
        <span class="bx-meta-line">
          <b>Reviews:</b>
          <span class="bx-editable-value" id="bx-reviews-value" title="Click to edit"
                tabindex="0" role="button" aria-label="Edit review count">${fmtNum(currentReviews)}</span>
          <span class="bx-edit-hint" aria-hidden="true">✎</span>
          <button class="bx-inline-reset" id="bx-reviews-reset" type="button"
                  title="Reset to whatever the page currently shows"
                  style="${currentReviewOverride != null ? '' : 'display:none'}">↺ reset</button>
        </span>
        <span class="bx-meta-line">
          <b id="bx-price-label">${priceLabelFor(currentPriceOverride != null)}:</b>
          ${isFree ? '<span>F2P / 0</span>' : `
            <span class="bx-editable-value" id="bx-price-value" title="Click to edit"
                  tabindex="0" role="button" aria-label="Edit base price">${fmtPrice(currentPrice, currency)}</span>
            <span class="bx-edit-hint" aria-hidden="true">✎</span>
            <button class="bx-inline-reset" id="bx-price-reset" type="button"
                    title="Reset to detected price"
                    style="${currentPriceOverride != null ? '' : 'display:none'}">↺ reset</button>
          `}
        </span>
      </div>
      <div class="bx-edit-note">Steam shows info however it pleases — if something looks off, just click the number and edit it yourself.</div>
      ${usingRegionalFallback ? `
        <div class="bx-warning">⚠ Couldn't fetch US price — using local price. Revenue figures may be off; regional pricing deduction skipped to avoid double-counting.</div>
      ` : ''}

      <div class="bx-section">
        <div class="bx-section-title">Estimated sales (copies) <span class="bx-hint">click to select</span></div>
        <table class="bx-table bx-sales-table" id="bx-sales-table"></table>
      </div>

      ${isFree ? `
        <div class="bx-section">
          <div class="bx-empty">F2P game or no detectable price — revenue can't be computed.</div>
        </div>
      ` : `
        <div class="bx-section">
          <div class="bx-section-title">Revenue (<span id="bx-tier-label">Mid 31x</span> · <span id="bx-price-header">${fmtPrice(currentPrice, currency)}</span>)</div>
          <div class="bx-controls">
            ${slider('avgDiscount', 'Avg. discount')}
            ${slider('refunds', 'Refunds & returns')}
            <button class="bx-reset" id="bx-reset-sliders" type="button">Reset to defaults</button>
          </div>
          <table class="bx-table" id="bx-revenue-table"></table>
          <label class="bx-vat">
            <input type="checkbox" id="bx-vat-toggle"> Apply VAT (20%)
          </label>
        </div>
      `}

      <div class="bx-section bx-gamalytic-section">
        <div class="bx-section-title">
          Gamalytic data
          <span class="bx-hint">third-party estimate</span>
        </div>
        <div class="bx-gamalytic-body" id="bx-gamalytic-body">
          <button class="bx-gamalytic-cta" id="bx-gamalytic-cta">Compare with Gamalytic</button>
        </div>
      </div>

      <div class="bx-footer">Rough estimate — treat as order of magnitude, not actual figures.</div>
    `;

    const tierLabels = { low: 'Low 20x', mid: 'Mid 31x', high: 'High 55x' };
    let currentTier = 'mid';

    const salesTable = wrapper.querySelector('#bx-sales-table');
    const renderSales = () => {
      const sales = calc.estimateSales(currentReviews);
      salesTable.innerHTML = `
        <tr class="bx-tier${currentTier === 'low' ? ' bx-selected' : ''}" data-tier="low"><td>Low <span class="bx-mult">20x</span></td><td class="bx-num">${fmtNum(sales.low)}</td></tr>
        <tr class="bx-tier${currentTier === 'mid' ? ' bx-selected' : ''}" data-tier="mid"><td>Mid <span class="bx-mult">31x</span></td><td class="bx-num">${fmtNum(sales.mid)}</td></tr>
        <tr class="bx-tier${currentTier === 'high' ? ' bx-selected' : ''}" data-tier="high"><td>High <span class="bx-mult">55x</span></td><td class="bx-num">${fmtNum(sales.high)}</td></tr>`;
      salesTable.querySelectorAll('.bx-tier').forEach(row => {
        row.addEventListener('click', () => {
          currentTier = row.dataset.tier;
          renderSales();
          renderRevenue();
        });
      });
      return sales;
    };

    let renderRevenue = () => {};

    if (!isFree) {
      const table = wrapper.querySelector('#bx-revenue-table');
      const toggle = wrapper.querySelector('#bx-vat-toggle');
      const tierLabelEl = wrapper.querySelector('#bx-tier-label');

      const priceHeaderEl = wrapper.querySelector('#bx-price-header');
      renderRevenue = () => {
        const sales = calc.estimateSales(currentReviews);
        const applyVAT = toggle.checked;
        const { gross, net, breakdown } = calc.estimateRevenue(sales[currentTier], currentPrice, {
          applyVAT,
          averageDiscount: current.avgDiscount,
          refunds: current.refunds,
          skipRegionalPricing: usingRegionalFallback,
        });
        tierLabelEl.textContent = tierLabels[currentTier];
        if (priceHeaderEl) priceHeaderEl.textContent = fmtPrice(currentPrice, currency);
        const rows = [
          `<tr><td>Gross</td><td class="bx-num">${fmtMoney(gross, currency)}</td></tr>`,
          ...breakdown.map(b => `
            <tr>
              <td class="bx-deduction">− ${b.label} (${Math.round(b.rate * 100)}%)</td>
              <td class="bx-num bx-deduction">−${fmtMoney(b.deducted, currency)}</td>
            </tr>`),
          `<tr class="bx-net"><td><b>Net to dev</b></td><td class="bx-num"><b>≈ ${fmtMoney(net, currency)}</b></td></tr>`,
        ];
        table.innerHTML = rows.join('');
      };

      const wireControl = (key) => {
        const slider = wrapper.querySelector(`#bx-${key}-slider`);
        const num = wrapper.querySelector(`#bx-${key}-num`);
        const r = RANGES[key];
        const apply = (raw) => {
          let val = parseInt(raw, 10);
          if (Number.isNaN(val)) val = 0;
          val = Math.max(r.min, Math.min(r.max, val));
          slider.value = String(val);
          num.value = String(val);
          current[key] = val / 100;
          saveSettings(current);
          renderRevenue();
        };
        slider.addEventListener('input', () => apply(slider.value));
        num.addEventListener('input', () => apply(num.value));
      };
      wireControl('avgDiscount');
      wireControl('refunds');

      const resetBtn = wrapper.querySelector('#bx-reset-sliders');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          for (const key of Object.keys(DEFAULT_SETTINGS)) {
            current[key] = DEFAULT_SETTINGS[key];
            const pct = Math.round(DEFAULT_SETTINGS[key] * 100);
            const slider = wrapper.querySelector(`#bx-${key}-slider`);
            const num = wrapper.querySelector(`#bx-${key}-num`);
            if (slider) slider.value = String(pct);
            if (num) num.value = String(pct);
          }
          saveSettings(current);
          renderRevenue();
        });
      }

      toggle.addEventListener('change', renderRevenue);
    }

    renderSales();
    renderRevenue();

    wireInlineEditor(wrapper, {
      valueId: 'bx-reviews-value',
      resetId: 'bx-reviews-reset',
      inputId: 'bx-reviews-input',
      inputStep: '1',
      inputMin: '1',
      ariaLabel: 'Edit review count',
      parseInput: (raw) => {
        const n = parseInt(raw, 10);
        return !Number.isNaN(n) && n > 0 ? n : null;
      },
      formatValue: (n) => fmtNum(n),
      getCurrent: () => currentReviews,
      reparseDetected: () => {
        const fresh = parser.parseReviewCount();
        return fresh != null ? fresh : detected;
      },
      setValue: (newValue, isReset) => {
        const isEffectiveReset = isReset || newValue === parser.parseReviewCount();
        currentReviews = newValue;
        currentReviewOverride = isEffectiveReset ? null : newValue;
        saveReviewOverride(appId, isEffectiveReset ? null : newValue);
        const resetBtn = wrapper.querySelector('#bx-reviews-reset');
        if (resetBtn) resetBtn.style.display = currentReviewOverride != null ? '' : 'none';
        renderSales();
        renderRevenue();
      },
    });

    if (!isFree) {
      wireInlineEditor(wrapper, {
        valueId: 'bx-price-value',
        resetId: 'bx-price-reset',
        inputId: 'bx-price-input',
        inputStep: '0.01',
        inputMin: '0',
        ariaLabel: 'Edit base price',
        parseInput: (raw) => {
          const n = parseFloat(raw);
          return !Number.isNaN(n) && n > 0 ? n : null;
        },
        formatValue: (n) => fmtPrice(n, currency),
        getCurrent: () => currentPrice,
        reparseDetected: () => detectedPrice,
        setValue: (newValue, isReset) => {
          const isEffectiveReset = isReset || newValue === detectedPrice;
          currentPrice = newValue;
          currentPriceOverride = isEffectiveReset ? null : newValue;
          savePriceOverride(appId, isEffectiveReset ? null : newValue);
          const resetBtn = wrapper.querySelector('#bx-price-reset');
          if (resetBtn) resetBtn.style.display = currentPriceOverride != null ? '' : 'none';
          const labelEl = wrapper.querySelector('#bx-price-label');
          if (labelEl) labelEl.textContent = `${priceLabelFor(currentPriceOverride != null)}:`;
          renderRevenue();
        },
      });
    }

    wireGamalytic(wrapper);

    return wrapper;
  }

  function wireInlineEditor(wrapper, {
    valueId, resetId, inputId,
    inputStep, inputMin, ariaLabel,
    parseInput, formatValue,
    getCurrent, reparseDetected, setValue,
  }) {
    const initialSpan = wrapper.querySelector(`#${valueId}`);
    const resetBtn = wrapper.querySelector(`#${resetId}`);
    if (!initialSpan) return;

    const startEdit = () => {
      // Re-query on every click — commit() swaps the span for a fresh node, so a captured
      // reference would point at a detached element and replaceWith would silently no-op.
      const currentSpan = wrapper.querySelector(`#${valueId}`);
      if (!currentSpan) return;
      if (wrapper.querySelector(`#${inputId}`)) return;
      const input = document.createElement('input');
      input.type = 'number';
      input.min = inputMin;
      input.step = inputStep;
      input.id = inputId;
      input.className = 'bx-editable-input';
      input.value = String(getCurrent());
      currentSpan.replaceWith(input);
      input.focus();
      input.select();

      let committed = false;
      const commit = (accept) => {
        if (committed) return;
        committed = true;
        let next = getCurrent();
        if (accept) {
          const parsed = parseInput(input.value);
          if (parsed != null) next = parsed;
        }
        const span = document.createElement('span');
        span.className = 'bx-editable-value';
        span.id = valueId;
        span.title = 'Click to edit';
        span.tabIndex = 0;
        span.setAttribute('role', 'button');
        span.setAttribute('aria-label', ariaLabel);
        span.textContent = formatValue(next);
        input.replaceWith(span);
        attach(span);
        if (accept && next !== getCurrent()) setValue(next, false);
      };
      input.addEventListener('blur', () => commit(true));
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); commit(true); }
        else if (e.key === 'Escape') { e.preventDefault(); commit(false); }
      });
    };

    const attach = (el) => {
      el.addEventListener('click', startEdit);
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startEdit(); }
      });
    };
    attach(initialSpan);

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        const fresh = reparseDetected();
        if (fresh == null) return;
        setValue(fresh, true);
        const v = wrapper.querySelector(`#${valueId}`);
        if (v) v.textContent = formatValue(fresh);
      });
    }
  }

  function wireGamalytic(wrapper) {
    const body = wrapper.querySelector('#bx-gamalytic-body');
    if (!body) return;
    const appId = getAppId();
    if (!appId) {
      body.innerHTML = `<div class="bx-empty">Couldn't detect the Steam app ID in the URL.</div>`;
      return;
    }

    const renderIdle = () => {
      body.innerHTML = `<button class="bx-gamalytic-cta" id="bx-gamalytic-cta">Compare with Gamalytic</button>`;
      body.querySelector('#bx-gamalytic-cta').addEventListener('click', () => {
        renderLoading();
        runFetch(false);
      });
    };

    const renderLoading = () => {
      body.innerHTML = `<div class="bx-loading">Fetching Gamalytic data…</div>`;
    };

    const renderError = (errMsg) => {
      body.innerHTML = `
        <div class="bx-error">${escapeHtml(errMsg)}</div>
        <div class="bx-actions">
          <button class="bx-btn-secondary" id="bx-retry">Retry</button>
        </div>`;
      body.querySelector('#bx-retry').addEventListener('click', () => {
        renderLoading();
        runFetch(true);
      });
    };

    const renderData = ({ data, cached, timestamp }) => {
      const rows = [];
      const row = (label, val) => rows.push(`<tr><td>${label}</td><td class="bx-num">${val}</td></tr>`);
      if (data.copiesSold != null) row('Copies sold', fmtNum(data.copiesSold));
      if (data.players != null && data.players !== data.copiesSold) row('Players (incl. keys)', fmtNum(data.players));
      if (data.revenue != null) row('Revenue (gross)', `$${fmtNum(data.revenue)}`);
      if (data.reviewScore != null) row('Review score', `${Math.round(data.reviewScore)}%`);
      if (data.avgPlaytime != null) row('Avg. playtime', `${data.avgPlaytime.toFixed(1)} h`);
      if (typeof data.steamPercent === 'number' && data.steamPercent < 1) {
        row('Bought on Steam', `${Math.round(data.steamPercent * 100)}%`);
      }
      if (data.followers != null) row('Followers', fmtNum(data.followers));
      if (typeof data.wishlists === 'number') row('Wishlists', fmtNum(data.wishlists));
      if (typeof data.accuracy === 'number') row('Estimate confidence', `${Math.round(data.accuracy * 100)}%`);

      const flags = [];
      if (data.unreleased) flags.push('unreleased');
      if (data.earlyAccess) flags.push('early access');
      const flagText = flags.length ? ` · ${flags.join(', ')}` : '';

      body.innerHTML = `
        <div class="bx-gamalytic-meta">
          ${cached ? 'Cached' : 'Fetched'} ${fmtAge(timestamp)}${flagText}
        </div>
        <table class="bx-table bx-gamalytic-table">${rows.join('')}</table>
        <div class="bx-actions">
          <button class="bx-btn-secondary" id="bx-refresh">↻ Refresh</button>
          <a class="bx-btn-link" href="https://gamalytic.com/game/${encodeURIComponent(appId)}" target="_blank" rel="noopener">View on Gamalytic ↗</a>
        </div>`;
      body.querySelector('#bx-refresh').addEventListener('click', () => {
        renderLoading();
        runFetch(true);
      });
    };

    const runFetch = async (force) => {
      const result = await fetchGamalytic(appId, force);
      if (result.ok) renderData(result);
      else renderError(result.error || 'Unknown error');
    };

    renderIdle();
  }

  async function mount() {
    if (document.getElementById('boxleiter-panel')) return;
    const appId = getAppId();
    const [settings, reviewOverride, priceOverride] = await Promise.all([
      loadSettings(),
      loadReviewOverride(appId),
      loadPriceOverride(appId),
    ]);
    const data = parser.parseGame();
    const detected = data.reviews;
    data.detected = detected;
    data.override = reviewOverride;
    data.appId = appId;
    if (reviewOverride != null) data.reviews = reviewOverride;

    // Try to upgrade the price to the US MSRP for accurate revenue calculations.
    if (appId) {
      const usResult = await fetchUsPrice(appId);
      if (usResult.ok) {
        if (usResult.source !== 'steam-us') {
          console.warn('[Gabe\'s Cut] Steam US price fetch failed, using fallback source:', usResult.source, usResult.steamError ? `Steam error: ${usResult.steamError}` : '');
        }
        data.price = {
          amount: usResult.amount,
          currency: '$',
          source: usResult.source,
          isFree: usResult.isFree,
        };
      } else if (data.price) {
        console.warn('[Gabe\'s Cut] All US-price sources failed; falling back to DOM-parsed regional price.', usResult.error);
        data.price.source = 'dom-regional';
      }
    }

    // Stash the detected price *after* US-price upgrade, so reset goes back to whatever
    // we'd display without user intervention — not the regional DOM price.
    data.detectedPrice = data.price && !data.price.isFree ? data.price.amount : null;
    data.priceOverride = priceOverride;
    if (priceOverride != null && data.price && !data.price.isFree) {
      data.price = { ...data.price, amount: priceOverride };
    }

    const panel = buildPanel(data, settings);

    const purchase = document.querySelector('#game_area_purchase');
    const reviewsBlock = document.querySelector('#userReviews');
    const fallback = document.querySelector('.game_meta_data') || document.querySelector('.rightcol') || document.body;

    if (purchase && purchase.parentNode) {
      purchase.parentNode.insertBefore(panel, purchase);
    } else if (reviewsBlock && reviewsBlock.parentNode) {
      reviewsBlock.parentNode.insertBefore(panel, reviewsBlock.nextSibling);
    } else {
      fallback.appendChild(panel);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
