/* Digifox Digital Marketing Quiz
   15 random questions · 30 minutes · 1 mark each · certificate at 12+ */
(function () {
  "use strict";

  /* ------------------------------------------------------------------
     SETTINGS
     Emails are sent by send.php (in this same folder) using your
     Hostinger mailbox info@digifoxprosolutions.com:
       • a notice to Digifox when someone starts the test
       • the PDF certificate to the participant when they score 12+,
         once they have added their Google review screenshot
         (the review step is in quiz/index.html)
     ------------------------------------------------------------------ */
  var MAILER_URL = "send.php";
  var NUM_QUESTIONS = 15;
  var TIME_LIMIT_SEC = 30 * 60;
  var PASS_MARK = 12;
  var WHATSAPP = "916282415200";

  var bank = window.DIGIFOX_QUESTIONS || [];
  var $ = function (id) { return document.getElementById(id); };
  var screens = { intro: $("quiz-intro"), test: $("quiz-test"), result: $("quiz-result") };
  var state = null, timerId = null;

  function show(name) {
    Object.keys(screens).forEach(function (k) { screens[k].hidden = k !== name; });
    var top = document.getElementById("quiz-app").getBoundingClientRect().top + window.pageYOffset - 110;
    window.scrollTo({ top: Math.max(top, 0), behavior: "smooth" });
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------- Start ---------- */
  $("quiz-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var form = e.target;
    if (!form.checkValidity()) { form.classList.add("was-validated"); return; }
    var user = {
      name: form.fullname.value.trim(),
      email: form.email.value.trim(),
      phone: form.phone.value.trim(),
      location: form.location.value.trim()
    };
    // pick questions, shuffle each question's options too
    var picked = shuffle(bank).slice(0, NUM_QUESTIONS).map(function (q) {
      var order = shuffle(q.o.map(function (_, i) { return i; }));
      return { t: q.t, q: q.q, o: order.map(function (i) { return q.o[i]; }), a: order.indexOf(q.a) };
    });
    state = { user: user, qs: picked, answers: new Array(picked.length).fill(null), i: 0, endAt: Date.now() + TIME_LIMIT_SEC * 1000, done: false };
    buildNav();
    renderQuestion();
    startTimer();
    show("test");
    post({ type: "start", name: user.name, email: user.email, phone: user.phone, location: user.location });
  });

  /* ---------- Question view ---------- */
  function buildNav() {
    var nav = $("q-nav"); nav.innerHTML = "";
    state.qs.forEach(function (_, i) {
      var b = document.createElement("button");
      b.type = "button"; b.textContent = i + 1; b.setAttribute("aria-label", "Go to question " + (i + 1));
      b.addEventListener("click", function () { state.i = i; renderQuestion(); });
      nav.appendChild(b);
    });
  }

  function renderQuestion() {
    var q = state.qs[state.i], n = state.qs.length;
    $("q-count").textContent = "Question " + (state.i + 1) + " of " + n;
    $("q-topic").textContent = q.t;
    $("q-text").textContent = q.q;
    var answered = state.answers.filter(function (x) { return x !== null; }).length;
    $("q-progress").style.width = (answered / n * 100) + "%";
    $("q-answered").textContent = answered + " / " + n + " answered";

    var box = $("q-options"); box.innerHTML = "";
    q.o.forEach(function (opt, idx) {
      var id = "opt-" + idx;
      var label = document.createElement("label");
      label.className = "q-option" + (state.answers[state.i] === idx ? " selected" : "");
      label.setAttribute("for", id);
      label.innerHTML = '<input type="radio" name="q-opt" id="' + id + '" value="' + idx + '"' +
        (state.answers[state.i] === idx ? " checked" : "") + '><span class="q-letter">' +
        "ABCD".charAt(idx) + "</span><span>" + esc(opt) + "</span>";
      label.querySelector("input").addEventListener("change", function () {
        state.answers[state.i] = idx;
        renderQuestion();
      });
      box.appendChild(label);
    });

    // card animation
    var card = $("q-card"); card.classList.remove("q-anim"); void card.offsetWidth; card.classList.add("q-anim");

    $("q-prev").disabled = state.i === 0;
    var last = state.i === n - 1;
    $("q-next").hidden = last;
    $("q-submit").hidden = !last;

    Array.prototype.forEach.call($("q-nav").children, function (b, i) {
      b.className = (state.answers[i] !== null ? "answered" : "") + (i === state.i ? " current" : "");
    });
  }

  $("q-prev").addEventListener("click", function () { if (state.i > 0) { state.i--; renderQuestion(); } });
  $("q-next").addEventListener("click", function () { if (state.i < state.qs.length - 1) { state.i++; renderQuestion(); } });
  $("q-submit").addEventListener("click", function () {
    var left = state.answers.filter(function (x) { return x === null; }).length;
    if (left > 0 && !window.confirm("You have " + left + " unanswered question" + (left > 1 ? "s" : "") + ". Submit anyway?")) return;
    finish(false);
  });

  /* keyboard: 1-4 / A-D to answer, arrows to move */
  document.addEventListener("keydown", function (e) {
    if (!state || state.done || screens.test.hidden) return;
    if (/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName) && document.activeElement.type !== "radio") return;
    var k = e.key.toUpperCase(), map = { "1": 0, "2": 1, "3": 2, "4": 3, A: 0, B: 1, C: 2, D: 3 };
    if (k in map && map[k] < state.qs[state.i].o.length) { state.answers[state.i] = map[k]; renderQuestion(); }
    else if (e.key === "ArrowRight") $("q-next").hidden || $("q-next").click();
    else if (e.key === "ArrowLeft") $("q-prev").click();
  });

  /* ---------- Timer ---------- */
  function startTimer() {
    clearInterval(timerId);
    tick();
    timerId = setInterval(tick, 1000);
  }
  function tick() {
    var left = Math.max(0, Math.round((state.endAt - Date.now()) / 1000));
    var m = Math.floor(left / 60), s = left % 60;
    $("q-timer").textContent = (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
    $("q-timer-wrap").classList.toggle("warn", left <= 300);
    if (left <= 0) finish(true);
  }

  /* warn before leaving mid-test */
  window.addEventListener("beforeunload", function (e) {
    if (state && !state.done && !screens.test.hidden) { e.preventDefault(); e.returnValue = ""; }
  });

  /* ---------- Results ---------- */
  function finish(timedOut) {
    if (state.done) return;
    state.done = true;
    clearInterval(timerId);
    var score = state.qs.reduce(function (s, q, i) { return s + (state.answers[i] === q.a ? 1 : 0); }, 0);
    var n = state.qs.length, passed = score >= PASS_MARK;
    state.score = score;
    state.certId = "DFX-" + new Date().getFullYear() + "-" + Math.random().toString(36).slice(2, 8).toUpperCase();

    $("r-timeout").hidden = !timedOut;
    $("r-score").textContent = score;
    $("r-total").textContent = "/ " + n;
    $("r-ring").style.setProperty("--pct", (score / n * 100) + "%");
    $("r-ring").classList.toggle("pass", passed);
    $("r-title").textContent = passed ? "Congratulations, " + state.user.name.split(" ")[0] + "! 🎉" : "Good effort, " + state.user.name.split(" ")[0] + "!";
    $("r-msg").textContent = passed
      ? "You scored " + score + " out of " + n + " and earned your Digifox certificate."
      : "You scored " + score + " out of " + n + ". You need " + PASS_MARK + " or more for a certificate. Try again with a fresh set of questions, or join our free Sunday demo class to learn more.";
    $("r-cert").hidden = !passed;

    // answer review
    var list = $("r-review"); list.innerHTML = "";
    state.qs.forEach(function (q, i) {
      var mine = state.answers[i], ok = mine === q.a;
      var li = document.createElement("li");
      li.className = ok ? "ok" : "bad";
      li.innerHTML = '<p class="mb-1 fw-semibold">' + (i + 1) + ". " + esc(q.q) + "</p>" +
        (ok ? '<p class="mb-0">✓ ' + esc(q.o[q.a]) + "</p>"
            : '<p class="mb-0 your">Your answer: ' + (mine === null ? "<em>not answered</em>" : esc(q.o[mine])) + "</p>" +
              '<p class="mb-0">Correct answer: <strong>' + esc(q.o[q.a]) + "</strong></p>");
      list.appendChild(li);
    });

    var mail = $("r-mail"); if (mail) mail.hidden = true;
    show("result");
    if (passed) { burst(); emailWhenReviewed(); }
  }

  /* ---------- Talking to send.php ---------- */
  function post(data) {
    if (location.protocol === "file:") return Promise.resolve(false);   // only works on the live site
    return fetch(MAILER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    }).then(function (r) { return r.ok ? r.json() : { ok: false }; })
      .then(function (j) { return !!(j && j.ok); })
      .catch(function () { return false; });
  }

  function setMailStatus(cls, html) {
    var el = $("r-mail"); if (!el) return;
    el.className = "r-mail " + cls; el.innerHTML = html; el.hidden = false;
  }

  /* The certificate is emailed only after the Google review step: the page adds the
     "r-reviewed" class to <html> and fires "digifox:reviewed" once a screenshot is added. */
  function hasReviewed() { return document.documentElement.classList.contains("r-reviewed"); }

  function emailWhenReviewed() {
    if (hasReviewed()) { emailCertificate(); return; }
    state.mailPending = true;
    setMailStatus("sending", "📧 Add your Google review screenshot below and we'll email your certificate to <strong>" + esc(state.user.email) + "</strong>.");
    var gate = $("r-gate"); if (gate) gate.hidden = false;
  }

  document.addEventListener("digifox:reviewed", function () {
    if (state && state.mailPending) { state.mailPending = false; emailCertificate(); }
  });

  /* email the certificate (as a PDF) to the participant */
  function emailCertificate() {
    var u = state.user;
    setMailStatus("sending", "📧 Sending your certificate to <strong>" + esc(u.email) + "</strong>…");
    makeCertificate(true, function (canvas) {
      var pdf;
      try { pdf = canvasToPdfBase64(canvas); } catch (e) { pdf = null; }
      if (!pdf) { setMailStatus("fail", "We couldn't email your certificate from here. Please use the download button below."); return; }
      post({ type: "certificate", name: u.name, email: u.email, phone: u.phone, location: u.location, score: state.score, pdf: pdf })
        .then(function (ok) {
          if (ok) setMailStatus("ok", "✅ Your certificate has been emailed to <strong>" + esc(u.email) + "</strong>. If you can't see it, check your spam folder.");
          else setMailStatus("fail", "We couldn't email your certificate right now. Please use the download button below.");
        });
    });
  }

  /* Build a one-page A4 landscape PDF containing the certificate image (no library needed) */
  function canvasToPdfBase64(canvas) {
    var jpgB64 = canvas.toDataURL("image/jpeg", 0.88).split(",")[1];
    var bin = atob(jpgB64), img = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) img[i] = bin.charCodeAt(i);
    var PW = 842, PH = 595, enc = new TextEncoder(), parts = [], offsets = [], len = 0;
    function add(x) { var b = typeof x === "string" ? enc.encode(x) : x; parts.push(b); len += b.length; }
    function obj(n, body) { offsets[n] = len; add(n + " 0 obj\n" + body + "\nendobj\n"); }
    add("%PDF-1.4\n");
    obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
    obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
    obj(3, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + PW + " " + PH + "] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>");
    offsets[4] = len;
    add("4 0 obj\n<< /Type /XObject /Subtype /Image /Width " + canvas.width + " /Height " + canvas.height +
        " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " + img.length + " >>\nstream\n");
    add(img); add("\nendstream\nendobj\n");
    var content = "q " + PW + " 0 0 " + PH + " 0 0 cm /Im0 Do Q";
    obj(5, "<< /Length " + content.length + " >>\nstream\n" + content + "\nendstream");
    var xref = len, x = "xref\n0 6\n0000000000 65535 f \n";
    for (var n = 1; n <= 5; n++) x += ("0000000000" + offsets[n]).slice(-10) + " 00000 n \n";
    add(x + "trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF");
    var all = new Uint8Array(len), p = 0;
    parts.forEach(function (b) { all.set(b, p); p += b.length; });
    var s = "", CH = 0x8000;
    for (var k = 0; k < all.length; k += CH) s += String.fromCharCode.apply(null, all.subarray(k, k + CH));
    return btoa(s);
  }

  $("r-retake").addEventListener("click", function () {
    state = null;
    $("quiz-form").classList.remove("was-validated");
    show("intro");
  });

  $("r-whatsapp").addEventListener("click", function () {
    var msg = "Hi, I just took the Digifox Digital Marketing Quiz and scored " + state.score + "/" + state.qs.length + ". I'd like to know more about your courses.";
    window.open("https://wa.me/" + WHATSAPP + "?text=" + encodeURIComponent(msg), "_blank", "noopener");
  });

  /* ---------- Certificate (drawn in the browser) ---------- */
  $("r-download").addEventListener("click", function () { makeCertificate(true, downloadPng); });

  function downloadPng(c) {
    var a = document.createElement("a");
    a.download = "Digifox-Certificate-" + state.user.name.replace(/[^a-z0-9]+/gi, "-") + ".png";
    a.href = c.toDataURL("image/png");
    document.body.appendChild(a); a.click(); a.remove();
  }

  function makeCertificate(withLogo, onReady) {
    var W = 2000, H = 1414, c = document.createElement("canvas");
    c.width = W; c.height = H;
    var x = c.getContext("2d");
    var orange = "#EC8A22", dark = "#111317";

    // background
    var g = x.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#1B1E24"); g.addColorStop(1, dark);
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    var rg = x.createRadialGradient(W * 0.85, H * 0.15, 10, W * 0.85, H * 0.15, 900);
    rg.addColorStop(0, "rgba(236,138,34,.35)"); rg.addColorStop(1, "rgba(236,138,34,0)");
    x.fillStyle = rg; x.fillRect(0, 0, W, H);

    // borders
    x.strokeStyle = orange; x.lineWidth = 10; x.strokeRect(50, 50, W - 100, H - 100);
    x.strokeStyle = "rgba(236,138,34,.35)"; x.lineWidth = 3; x.strokeRect(80, 80, W - 160, H - 160);

    x.textAlign = "center";
    function text(str, y, font, color) { x.font = font; x.fillStyle = color; x.fillText(str, W / 2, y); }

    function finishDrawing() {
      text("CERTIFICATE OF ACHIEVEMENT", 470, "700 64px Roboto, Arial, sans-serif", orange);
      text("This is to certify that", 580, "400 40px Roboto, Arial, sans-serif", "rgba(255,255,255,.8)");
      // name (shrink to fit)
      var size = 110; x.font = "700 " + size + "px Roboto, Arial, sans-serif";
      while (x.measureText(state.user.name).width > W - 400 && size > 50) { size -= 4; x.font = "700 " + size + "px Roboto, Arial, sans-serif"; }
      text(state.user.name, 720, x.font, "#FFFFFF");
      x.fillStyle = orange; x.fillRect(W / 2 - 300, 760, 600, 4);
      text("has successfully passed the Digifox Digital Marketing Quiz", 860, "400 42px Roboto, Arial, sans-serif", "rgba(255,255,255,.85)");
      text("with a score of " + state.score + " / " + state.qs.length, 930, "700 46px Roboto, Arial, sans-serif", orange);
      text("covering SEO, Google Ads, Meta Ads, Analytics, Email & Social Media Marketing", 1000, "400 32px Roboto, Arial, sans-serif", "rgba(255,255,255,.6)");

      var d = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
      x.textAlign = "left";
      x.font = "400 30px Roboto, Arial, sans-serif"; x.fillStyle = "rgba(255,255,255,.6)";
      x.fillText("Date", 220, 1170);
      x.fillText("Certificate ID", 220, 1250);
      x.font = "700 34px Roboto, Arial, sans-serif"; x.fillStyle = "#fff";
      x.fillText(d, 220, 1210);
      x.fillText(state.certId, 220, 1290);
      x.textAlign = "right";
      x.fillStyle = "rgba(255,255,255,.4)"; x.fillRect(W - 620, 1220, 400, 2);
      x.font = "700 34px Roboto, Arial, sans-serif"; x.fillStyle = "#fff";
      x.fillText("Digifox Pro Solutions LLP", W - 220, 1270);
      x.font = "400 28px Roboto, Arial, sans-serif"; x.fillStyle = "rgba(255,255,255,.6)";
      x.fillText("digifoxprosolutions.com", W - 220, 1310);

      try {
        c.toDataURL("image/png");          // throws if the browser blocked the logo image
        onReady(c);
      } catch (err) {
        // happens only when the page is opened straight from the computer – redraw without the logo
        if (withLogo) makeCertificate(false, onReady);
      }
    }

    if (withLogo) {
      var img = new Image();
      img.onload = function () {
        var w = 760, h = img.height * w / img.width;
        x.drawImage(img, (W - w) / 2, 150, w, h);
        finishDrawing();
      };
      img.onerror = function () { textLogo(); finishDrawing(); };
      img.src = "../images/logo.png";
    } else { textLogo(); finishDrawing(); }

    function textLogo() {
      text("DIGIFOX PRO", 260, "700 96px Roboto, Arial, sans-serif", "#fff");
      text("S O L U T I O N S", 320, "400 36px Roboto, Arial, sans-serif", "rgba(255,255,255,.8)");
    }
  }

  /* little celebration on pass */
  function burst() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var wrap = document.createElement("div"); wrap.className = "confetti";
    var colors = ["#EC8A22", "#FFFFFF", "#D2702A", "#F5B301"];
    for (var i = 0; i < 60; i++) {
      var p = document.createElement("i");
      p.style.left = Math.random() * 100 + "%";
      p.style.background = colors[i % colors.length];
      p.style.animationDelay = Math.random() * 0.6 + "s";
      p.style.animationDuration = 2.2 + Math.random() * 1.6 + "s";
      p.style.transform = "rotate(" + Math.random() * 360 + "deg)";
      wrap.appendChild(p);
    }
    document.body.appendChild(wrap);
    setTimeout(function () { wrap.remove(); }, 4500);
  }
})();
