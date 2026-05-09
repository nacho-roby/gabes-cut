(function () {
  function parseReviewCount() {
    // Steam now splits review counts: meta[itemprop="reviewCount"] reports only the user's language.
    // The cross-language total lives in .review_summary_count.
    const totalEl = document.querySelector('.review_summary_count');
    if (totalEl) {
      const m = totalEl.textContent.match(/([\d.,]+)/);
      if (m) {
        const n = parseInt(m[1].replace(/[.,]/g, ''), 10);
        if (!Number.isNaN(n) && n > 0) return n;
      }
    }
    const metas = document.querySelectorAll('meta[itemprop="reviewCount"]');
    let maxFromMeta = 0;
    for (const meta of metas) {
      const n = parseInt(meta.content, 10);
      if (!Number.isNaN(n) && n > maxFromMeta) maxFromMeta = n;
    }
    if (maxFromMeta > 0) return maxFromMeta;
    const tooltip = document.querySelector('#userReviews .user_reviews_summary_row[data-tooltip-html]');
    if (tooltip) {
      const html = tooltip.getAttribute('data-tooltip-html') || '';
      const m = html.match(/([\d.,]+)\s+user reviews/i);
      if (m) {
        const n = parseInt(m[1].replace(/[.,]/g, ''), 10);
        if (!Number.isNaN(n)) return n;
      }
    }
    const spans = document.querySelectorAll('#userReviews .responsive_hidden');
    for (const s of spans) {
      const m = s.textContent.match(/([\d.,]+)/);
      if (m) {
        const n = parseInt(m[1].replace(/[.,]/g, ''), 10);
        if (!Number.isNaN(n) && n > 0) return n;
      }
    }
    return null;
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
