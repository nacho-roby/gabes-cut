(function () {
  function parseReviewCount() {
    const meta = document.querySelector('meta[itemprop="reviewCount"]');
    if (meta && meta.content) {
      const n = parseInt(meta.content, 10);
      if (!Number.isNaN(n)) return n;
    }
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
    const original = document.querySelector('.discount_original_price');
    if (original) {
      const parsed = parsePriceText(original.textContent);
      if (parsed) return parsed;
    }
    const finalEl = document.querySelector('.game_purchase_price[data-price-final]');
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
    const any = document.querySelector('.game_purchase_price');
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
