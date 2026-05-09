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

    const current = { ...settings };

    const slider = (key, label) => {
      const r = RANGES[key];
      const pct = Math.round(current[key] * 100);
      return `
        <div class="bx-control">
          <label class="bx-control-label" for="bx-${key}-num">${label}</label>
          <input type="range" class="bx-slider" id="bx-${key}-slider"
                 min="${r.min}" max="${r.max}" step="1" value="${pct}">
          <input type="number" class="bx-num-input" id="bx-${key}-num"
                 min="${r.min}" max="${r.max}" step="1" value="${pct}">
          <span class="bx-pct">%</span>
        </div>`;
    };

    wrapper.innerHTML = `
      <div class="bx-header">💰 Gabe's Cut</div>
      <div class="bx-meta">
        <span><b>Reviews:</b> ${fmtNum(reviews)}</span>
        <span><b>Base price:</b> ${isFree ? 'F2P / 0' : fmtMoney(basePrice, currency)}</span>
      </div>

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
          <div class="bx-section-title">Revenue (<span id="bx-tier-label">Mid 31x</span> · ${fmtMoney(basePrice, currency)})</div>
          <div class="bx-controls">
            ${slider('avgDiscount', 'Avg. discount')}
            ${slider('refunds', 'Refunds & returns')}
          </div>
          <table class="bx-table" id="bx-revenue-table"></table>
          <label class="bx-vat">
            <input type="checkbox" id="bx-vat-toggle"> Apply VAT (20%)
          </label>
        </div>
      `}

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

    return wrapper;
  }

  async function mount() {
    if (document.getElementById('boxleiter-panel')) return;
    const settings = await loadSettings();
    const data = parser.parseGame();
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
