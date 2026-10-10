(function () {
  "use strict";
  var key = "psg_cookie_consent";
  var panel = document.getElementById("visitor-analytics-choice");
  var loaded = false;

  function apply(choice) {
    // Preserve other categories; this control manages first-party analytics only.
    window.__psgConsent = Object.assign({}, choice, { analytics: choice.analytics === true });
    if (!window.__psgConsent.analytics) return;
    if (loaded) {
      window.psgTracker?.init();
      return;
    }
    loaded = true;
    var script = document.createElement("script");
    script.src = "https://partner.priceservicesgroup.com/psg-tracker.js";
    script.onerror = function () { loaded = false; };
    document.body.appendChild(script);
  }

  var stored = null;
  try {
    var parsed = JSON.parse(localStorage.getItem(key));
    if (parsed && typeof parsed.analytics === "boolean") stored = parsed;
  } catch (_) {}
  apply(stored || { essential: true, analytics: false });
  if (panel) panel.hidden = !!stored;

  document.querySelectorAll("[data-analytics-choice]").forEach(function (button) {
    button.addEventListener("click", function () {
      var choice = Object.assign({}, window.__psgConsent, {
        essential: true,
        analytics: button.dataset.analyticsChoice === "allow",
        timestamp: Date.now(),
      });
      try { localStorage.setItem(key, JSON.stringify(choice)); } catch (_) {}
      apply(choice);
      if (panel) panel.hidden = true;
    });
  });
  document.getElementById("visitor-analytics-preferences")?.addEventListener("click", function () {
    if (panel) {
      panel.hidden = false;
      panel.querySelector("button")?.focus();
    }
  });
})();
