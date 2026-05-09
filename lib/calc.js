(function () {
  const MULTIPLIERS = { low: 20, mid: 31, high: 55 };

  const DEDUCTIONS = {
    averageDiscount: 0.10,
    refunds: 0.05,
    regionalPricing: 0.15,
    steamCut: 0.30,
    vat: 0.20,
  };

  function estimateSales(reviews) {
    return {
      low:  Math.round(reviews * MULTIPLIERS.low),
      mid:  Math.round(reviews * MULTIPLIERS.mid),
      high: Math.round(reviews * MULTIPLIERS.high),
    };
  }

  function estimateRevenue(sales, basePrice, { applyVAT = false } = {}) {
    const gross = sales * basePrice;
    const steps = [
      { label: 'Average discounts',   rate: DEDUCTIONS.averageDiscount },
      { label: 'Refunds',             rate: DEDUCTIONS.refunds },
      { label: 'Regional pricing',    rate: DEDUCTIONS.regionalPricing },
      { label: "Gabe's Cut",          rate: DEDUCTIONS.steamCut },
    ];
    if (applyVAT) steps.push({ label: 'VAT', rate: DEDUCTIONS.vat });

    let running = gross;
    const breakdown = steps.map(s => {
      const deducted = running * s.rate;
      running -= deducted;
      return { label: s.label, rate: s.rate, deducted, remaining: running };
    });
    return { gross, net: running, breakdown };
  }

  window.Boxleiter = window.Boxleiter || {};
  window.Boxleiter.calc = { MULTIPLIERS, DEDUCTIONS, estimateSales, estimateRevenue };
})();
