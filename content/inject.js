(function () {
  const { calc, parser } = window.Boxleiter;

  const STORAGE_KEY = 'boxleiter_settings';
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

  function buildPanel({ title, reviews, price }, settings) {
    const wrapper = document.createElement('div');
    wrapper.className = 'boxleiter-panel';
    wrapper.id = 'boxleiter-panel';

    if (reviews == null) {
      wrapper.innerHTML = `
        <div class="bx-header">💰 Gabe's Cut</div>
        <div class="bx-empty">Couldn't detect the review count on this page.</div>`;
      return wrapper;
    }

    if (reviews === 0) {
      wrapper.innerHTML = `
        <div class="bx-header">💰 Gabe's Cut</div>
        <div class="bx-empty">No reviews yet — can't estimate.</div>`;
      return wrapper;
    }

    const sales = calc.estimateSales(reviews);
    const isFree = !price || price.amount === 0;
    const currency = price ? price.currency : '$';
    const basePrice = price ? price.amount : 0;
    const priceSource = price ? price.source : null;
    const priceLabel = priceSource === 'steam-us' ? 'Base price (US)'
      : priceSource === 'gamalytic-cache' ? 'Base price (Gamalytic)'
      : 'Base price';
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
        <span><b>Reviews:</b> ${fmtNum(reviews)}</span>
        <span><b>${priceLabel}:</b> ${isFree ? 'F2P / 0' : fmtPrice(basePrice, currency)}</span>
      </div>
      ${usingRegionalFallback ? `
        <div class="bx-warning">⚠ Couldn't fetch US price — using local price. Revenue figures may be off; regional pricing deduction skipped to avoid double-counting.</div>
      ` : ''}

      <div class="bx-section">
        <div class="bx-section-title">Estimated sales (copies) <span class="bx-hint">click to select</span></div>
        <table class="bx-table bx-sales-table">
          <tr class="bx-tier" data-tier="low"><td>Low <span class="bx-mult">20x</span></td><td class="bx-num">${fmtNum(sales.low)}</td></tr>
          <tr class="bx-tier bx-selected" data-tier="mid"><td>Mid <span class="bx-mult">31x</span></td><td class="bx-num">${fmtNum(sales.mid)}</td></tr>
          <tr class="bx-tier" data-tier="high"><td>High <span class="bx-mult">55x</span></td><td class="bx-num">${fmtNum(sales.high)}</td></tr>
        </table>
      </div>

      ${isFree ? `
        <div class="bx-section">
          <div class="bx-empty">F2P game or no detectable price — revenue can't be computed.</div>
        </div>
      ` : `
        <div class="bx-section">
          <div class="bx-section-title">Revenue (<span id="bx-tier-label">Mid 31x</span> · ${fmtPrice(basePrice, currency)})</div>
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

    if (!isFree) {
      const table = wrapper.querySelector('#bx-revenue-table');
      const toggle = wrapper.querySelector('#bx-vat-toggle');
      const tierLabelEl = wrapper.querySelector('#bx-tier-label');

      const render = () => {
        const applyVAT = toggle.checked;
        const { gross, net, breakdown } = calc.estimateRevenue(sales[currentTier], basePrice, {
          applyVAT,
          averageDiscount: current.avgDiscount,
          refunds: current.refunds,
          skipRegionalPricing: usingRegionalFallback,
        });
        tierLabelEl.textContent = tierLabels[currentTier];
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
          render();
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
          render();
        });
      }

      render();
      toggle.addEventListener('change', render);

      wrapper.querySelectorAll('.bx-tier').forEach(row => {
        row.addEventListener('click', () => {
          currentTier = row.dataset.tier;
          wrapper.querySelectorAll('.bx-tier').forEach(r => r.classList.toggle('bx-selected', r === row));
          render();
        });
      });
    }

    wireGamalytic(wrapper);

    return wrapper;
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
    const settings = await loadSettings();
    const data = parser.parseGame();

    // Try to upgrade the price to the US MSRP for accurate revenue calculations.
    const appId = getAppId();
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
