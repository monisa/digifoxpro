/*
 * Cookie notice for digifoxprosolutions.com.
 * Google Analytics, Microsoft Clarity and the Meta Pixel load normally.
 * "Decline" switches them off (now and on later visits); "Accept" keeps them on.
 * The choice is remembered in this browser (localStorage "dfp_consent").
 * The <head> of each page reads the same choice before the tags start.
 */
(function () {
  var KEY = 'dfp_consent';
  var choice = null;
  try { choice = localStorage.getItem(KEY); } catch (e) {}

  function apply(granted) {
    var v = granted ? 'granted' : 'denied';
    try { window.gtag && gtag('consent', 'update', { analytics_storage: v, ad_storage: v, ad_user_data: v, ad_personalization: v }); } catch (e) {}
    try { window.fbq && fbq('consent', granted ? 'grant' : 'revoke'); } catch (e) {}
    try {
      if (window.clarity) {
        clarity('consentv2', { ad_Storage: v, analytics_Storage: v });
        if (!granted) clarity('consent', false);
      }
    } catch (e) {}
  }

  function save(granted) {
    try { localStorage.setItem(KEY, granted ? 'granted' : 'denied'); } catch (e) {}
    apply(granted);
  }

  // Path to the privacy page from this page (works from / and from /folder/).
  var depth = location.pathname.replace(/[^/]*$/, '').split('/').filter(Boolean).length;
  var privacy = (depth ? '../'.repeat(depth) : '') + 'privacy-policy/';

  // "Cookie settings" link in the footer reopens the notice.
  window.dfpCookieSettings = function () { show(true); return false; };

  function show(force) {
    if (document.getElementById('dfp-cookie')) return;
    var box = document.createElement('div');
    box.id = 'dfp-cookie';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-live', 'polite');
    box.setAttribute('aria-label', 'Cookie notice');
    box.innerHTML =
      '<p><b>We use cookies 🍪</b> to understand how visitors use our site (Google Analytics, Microsoft Clarity) and to measure our ads (Meta Pixel). ' +
      '<a href="' + privacy + '">Privacy &amp; Cookie Policy</a></p>' +
      '<div class="dfp-cookie-btns"><button type="button" class="dfp-decline">Decline</button>' +
      '<button type="button" class="dfp-accept">Accept</button></div>';
    var css = document.createElement('style');
    css.textContent =
      '#dfp-cookie{position:fixed;left:16px;bottom:16px;z-index:2147483000;max-width:420px;background:#15171C;color:#fff;border-radius:14px;' +
      'padding:16px 18px;box-shadow:0 18px 40px rgba(0,0,0,.35);font:14px/1.5 Roboto,system-ui,sans-serif;animation:dfpIn .35s ease}' +
      '#dfp-cookie p{margin:0 0 12px}#dfp-cookie a{color:#EC8A22;text-decoration:underline}' +
      '.dfp-cookie-btns{display:flex;gap:8px;justify-content:flex-end}' +
      '#dfp-cookie button{border:0;border-radius:99px;padding:8px 18px;font:600 13px Roboto,system-ui,sans-serif;cursor:pointer;text-transform:uppercase;letter-spacing:.03em}' +
      '#dfp-cookie .dfp-decline{background:transparent;color:#fff;border:1px solid rgba(255,255,255,.4)}' +
      '#dfp-cookie .dfp-accept{background:#EC8A22;color:#15171C}' +
      '@keyframes dfpIn{from{opacity:0;transform:translateY(12px)}}' +
      '@media (max-width:600px){#dfp-cookie{left:10px;right:10px;bottom:10px;max-width:none}}' +
      '@media (prefers-reduced-motion:reduce){#dfp-cookie{animation:none}}';
    document.head.appendChild(css);
    document.body.appendChild(box);
    box.querySelector('.dfp-accept').onclick = function () { save(true); box.remove(); };
    box.querySelector('.dfp-decline').onclick = function () { save(false); box.remove(); };
  }

  if (!choice) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { show(); });
    else show();
  }
})();
