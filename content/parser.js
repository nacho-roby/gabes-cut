(function () {
  function parseReviewCount() {
    // Steam renders review counts in multiple places and the "primary" one shifts based on
    // the user's language/region filters (e.g. Mixtape shows ".review_summary_count" as
    // "Reseñas en Español de España: 117" while the cross-language total "4,956 reseñas"
    // lives in the .responsive_hidden span). Collect every candidate and pick the maximum —
    // the global total is always ≥ any language-filtered subset.
    const candidates = [];
    const pushNum = (raw) => {
      if (raw == null) return;
      const m = String(raw).match(/([\d.,]+)/);
      if (!m) return;
      const n = parseInt(m[1].replace(/[.,]/g, ''), 10);
      if (!Number.isNaN(n) && n > 0) candidates.push(n);
    };

    const totalEl = document.querySelector('.review_summary_count');
    if (totalEl) pushNum(totalEl.textContent);

    document.querySelectorAll('meta[itemprop="reviewCount"]').forEach(meta => pushNum(meta.content));

    const tooltip = document.querySelector('#userReviews .user_reviews_summary_row[data-tooltip-html]');
    if (tooltip) {
      const html = tooltip.getAttribute('data-tooltip-html') || '';
      const m = html.match(/([\d.,]+)\s+user reviews/i);
      if (m) pushNum(m[1]);
    }

    document.querySelectorAll('#userReviews .responsive_hidden').forEach(s => pushNum(s.textContent));

    if (!candidates.length) return null;
    return Math.max(...candidates);
  }

  function parsePrice() {
    // Scope to the base game's purchase block so DLC/bundle prices listed lower
    // on the page can't be picked up by accident (e.g. F2P games with paid DLCs).
    // Skip blocks without price elements — those are demos, playtests, soundtracks, etc.
    const candidates = document.querySelectorAll(
      '#game_area_purchase .game_area_purchase_game_wrapper, #game_area_purchase .game_area_purchase_game, .game_area_purchase_game_wrapper, .game_area_purchase_game'
    );
    let baseScope = null;
    for (const el of candidates) {
      if (el.querySelector('.game_purchase_price, .discount_original_price')) {
        baseScope = el;
        break;
      }
    }
    const scope = baseScope || document;

    const original = scope.querySelector('.discount_original_price');
    if (original) {
      const parsed = parsePriceText(original.textContent);
      if (parsed) return parsed;
    }
    const finalEl = scope.querySelector('.game_purchase_price[data-price-final]');
    if (finalEl) {
      const cents = parseInt(finalEl.dataset.priceFinal, 10);
      if (!Number.isNaN(cents)) {
        const parsedText = parsePriceText(finalEl.textContent);
        return {
          amount: cents / 100,
          currency: parsedText ? parsedText.currency : detectCurrency(finalEl.textContent),
        };
      }
      const parsed = parsePriceText(finalEl.textContent);
      if (parsed) return parsed;
    }
    const any = scope.querySelector('.game_purchase_price');
    if (any) {
      const parsed = parsePriceText(any.textContent);
      if (parsed) return parsed;
    }
    return null;
  }

  function parsePriceText(raw) {
    if (!raw) return null;
    const text = raw.trim();
    if (/free|gratis|f2p/i.test(text)) return { amount: 0, currency: detectCurrency(text) };
    const m = text.match(/([\d.,]+)/);
    if (!m) return null;
    const num = normalizeNumber(m[1]);
    if (Number.isNaN(num)) return null;
    return { amount: num, currency: detectCurrency(text) };
  }

  function normalizeNumber(str) {
    const lastComma = str.lastIndexOf(',');
    const lastDot = str.lastIndexOf('.');
    let normalized;
    if (lastComma === -1 && lastDot === -1) {
      normalized = str;
    } else if (lastComma > lastDot) {
      normalized = str.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = str.replace(/,/g, '');
    }
    return parseFloat(normalized);
  }

  function detectCurrency(text) {
    if (/USD|\$/i.test(text) && !/ARS/i.test(text)) return '$';
    if (/€|EUR/i.test(text)) return '€';
    if (/£|GBP/i.test(text)) return '£';
    if (/ARS/i.test(text)) return 'ARS$';
    const m = text.match(/[A-Z]{3}/);
    if (m) return m[0];
    return '$';
  }

  function parseGame() {
    const reviews = parseReviewCount();
    const price = parsePrice();
    const titleEl = document.querySelector('#appHubAppName, .apphub_AppName');
    const title = titleEl ? titleEl.textContent.trim() : (document.title || '').replace(' on Steam', '');
    return { title, reviews, price };
  }

  window.Boxleiter = window.Boxleiter || {};
  window.Boxleiter.parser = { parseGame, parseReviewCount, parsePrice };
})();
