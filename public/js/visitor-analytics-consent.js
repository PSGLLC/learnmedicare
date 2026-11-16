(function () {
  "use strict";
  var key = "psg_cookie_consent";
  var panel = document.getElementById("visitor-analytics-choice");
  var preferences = document.getElementById("visitor-analytics-preferences");
  var loaded = false;

  function setPanelVisible(visible) {
    if (!panel) return;
    panel.hidden = !visible;
    preferences?.setAttribute("aria-expanded", String(visible));
  }

  function apply(choice) {
    window.__psgConsent = Object.assign({}, choice, { analytics: choice.analytics === true });
    if (choice.marketing === true) window.__loadMarketing?.();
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
  var analyticsChosen = !!stored;
  apply(stored || { essential: true, analytics: false });
  setPanelVisible(!(!!stored && typeof stored.marketing === 'boolean'));

  document.querySelectorAll("[data-analytics-choice]").forEach(function (button) {
    button.addEventListener("click", function () {
      analyticsChosen = true;
      var choice = Object.assign({}, window.__psgConsent, {
        essential: true,
        analytics: button.dataset.analyticsChoice === "allow",
        timestamp: Date.now(),
      });
      try { localStorage.setItem(key, JSON.stringify(choice)); } catch (_) {}
      if (window.__psgConsent.analytics === true && !choice.analytics) {
        window.__psgConsent = choice;
        window.location.reload();
        return;
      }
      apply(choice);
      setPanelVisible(typeof choice.marketing !== 'boolean');
    });
  });
  document.querySelectorAll('[data-marketing-choice]').forEach(function (button) {
    button.addEventListener('click', function () {
      var choice = Object.assign({}, window.__psgConsent, { essential: true, marketing: button.dataset.marketingChoice === 'allow', timestamp: Date.now() });
      try { localStorage.setItem(key, JSON.stringify(choice)); } catch (_) {}
      if (window.__psgConsent.marketing === true && !choice.marketing) {
        window.__psgConsent = choice;
        window.location.reload();
        return;
      }
      apply(choice);
      setPanelVisible(!analyticsChosen);
    });
  });
  preferences?.addEventListener("click", function () {
    setPanelVisible(true);
    panel?.querySelector("button")?.focus();
  });

  // This compact preference strip is intentionally nonmodal: Escape simply
  // dismisses it without recording a choice or changing any consent state.
  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape" || !panel || panel.hidden) return;
    event.preventDefault();
    setPanelVisible(false);
    preferences?.focus();
  });
})();
