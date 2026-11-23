/* =========================================================
   KLYR — site behaviour
   Settings live in assets/js/config.js
   ========================================================= */
(function () {
  "use strict";
  document.documentElement.classList.add("js");

  var CFG = window.KLYR_CONFIG || {};
  var SUPABASE_URL = (CFG.supabaseUrl || "").trim();
  var SUPABASE_KEY = (CFG.supabaseAnonKey || "").trim();
  var WAITLIST_ENDPOINT = (CFG.waitlistEndpoint || "").trim();
  var HAS_SUPABASE = !!(SUPABASE_URL && SUPABASE_KEY);
  var SUPABASE_LIB = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js";

  var host = location.hostname;
  var isLocal = location.protocol === "file:" || host === "localhost" || host === "127.0.0.1" || host === "";
  var page = document.body.getAttribute("data-page") || "";

  /* =========================================================
     Supabase client (loaded only when configured)
     ========================================================= */
  var REMEMBER_KEY = "klyr.remember";
  var libPromise = null, clientPromise = null;

  function safeStorage(name) {
    try { var s = window[name]; s.setItem("klyr.test", "1"); s.removeItem("klyr.test"); return s; }
    catch (e) { return undefined; } // private mode etc. — Supabase falls back to memory
  }
  function rememberPref() {
    try { return localStorage.getItem(REMEMBER_KEY) !== "0"; } catch (e) { return true; }
  }
  function loadLib() {
    if (window.supabase && window.supabase.createClient) return Promise.resolve(window.supabase);
    if (!libPromise) {
      libPromise = new Promise(function (resolve, reject) {
        var s = document.createElement("script");
        s.src = SUPABASE_LIB; s.async = true; s.crossOrigin = "anonymous";
        s.onload = function () { window.supabase ? resolve(window.supabase) : reject(new Error("network")); };
        s.onerror = function () { libPromise = null; reject(new Error("network")); };
        document.head.appendChild(s);
      });
    }
    return libPromise;
  }
  // remember: true/false when logging in (switches where the session is stored); omit otherwise.
  function getClient(remember) {
    if (!HAS_SUPABASE) return Promise.reject(new Error("not-configured"));
    if (typeof remember === "boolean") {
      try { localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0"); } catch (e) {}
      clientPromise = null;
    }
    if (!clientPromise) {
      var storage = safeStorage(rememberPref() ? "localStorage" : "sessionStorage");
      clientPromise = loadLib().then(function (lib) {
        return lib.createClient(SUPABASE_URL, SUPABASE_KEY, {
          auth: { storage: storage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
        });
      });
    }
    return clientPromise;
  }
  function getSession() {
    return getClient().then(function (c) { return c.auth.getSession(); })
      .then(function (r) { return r.data && r.data.session; });
  }

  function friendly(err) {
    var m = (err && (err.message || err.error_description)) || "";
    if (/invalid login credentials/i.test(m)) return "That email and password don't match. Please try again.";
    if (/email not confirmed/i.test(m)) return "Please confirm your email first — check your inbox for the link from KLYR.";
    if (/already (been )?registered/i.test(m)) return "An account with this email already exists. Try logging in instead.";
    if (/rate limit|too many|security purposes/i.test(m)) return "Too many attempts. Please wait a minute and try again.";
    if (/password/i.test(m) && /(least|weak|short|characters)/i.test(m)) return "Please choose a stronger password.";
    if (/same.*password|different from the old/i.test(m)) return "Your new password must be different from your old one.";
    if (/network|fetch|load failed/i.test(m)) return "We couldn't reach the server. Please check your connection and try again.";
    return m || "Something went wrong. Please try again.";
  }
  function siteUrl(path) {
    return location.origin + location.pathname.replace(/[^/]*$/, "") + path;
  }

  /* ---------- Header: show "Account" when signed in ---------- */
  if (HAS_SUPABASE) {
    getSession().then(function (session) {
      if (!session) return;
      document.querySelectorAll('.nav__login, .header-login, .site-footer a[href="login.html"]').forEach(function (a) {
        a.setAttribute("href", "account.html");
        var t = a.lastChild;
        if (t && t.nodeType === 3) t.textContent = "Account"; else a.textContent = "Account";
      });
    }).catch(function () {});
  }

  /* =========================================================
     General UI
     ========================================================= */
  var header = document.querySelector(".site-header");
  function onScroll() { if (header) header.classList.toggle("is-scrolled", window.scrollY > 24); }
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  var toggle = document.querySelector(".nav-toggle");
  if (toggle) {
    toggle.addEventListener("click", function () {
      var open = document.body.classList.toggle("nav-open");
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    });
    document.querySelectorAll(".nav a").forEach(function (a) {
      a.addEventListener("click", function () {
        document.body.classList.remove("nav-open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && document.body.classList.contains("nav-open")) toggle.click();
    });
  }

  var revealEls = document.querySelectorAll(".reveal, .reveal-left, .reveal-zoom, .statement span");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add("is-in"); io.unobserve(entry.target); }
      });
    }, { rootMargin: "0px 0px -12% 0px", threshold: 0.1 });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("is-in"); });
  }

  var can = document.querySelector(".hero__can");
  var word = document.querySelector(".hero__word");
  if (can && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    window.addEventListener("scroll", function () {
      var y = window.scrollY;
      if (y > window.innerHeight) return;
      can.style.transform = "translateY(" + y * 0.12 + "px)";
      if (word) word.style.transform = "translate(calc(-50% - " + y * 0.25 + "px), -50%)";
    }, { passive: true });
  }

  document.querySelectorAll("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });

  /* =========================================================
     Form helpers
     ========================================================= */
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var PW_RULE = "Use at least 8 characters, including a letter and a number.";
  function strongPassword(pw) { return pw.length >= 8 && /[A-Za-z]/.test(pw) && /\d/.test(pw); }

  function setError(form, input, msg) {
    var err = form.querySelector('[data-error-for="' + input.name + '"]');
    input.setAttribute("aria-invalid", msg ? "true" : "false");
    if (err) err.textContent = msg || "";
  }
  function focusFirstError(form) {
    var first = form.querySelector('[aria-invalid="true"]');
    if (first) first.focus();
  }
  function setBusy(btn, busy, label) {
    btn.disabled = busy;
    btn.querySelector("span").textContent = label;
  }
  function say(el, text, html) {
    if (!el) return;
    if (html) el.innerHTML = text; else el.textContent = text;
  }

  /* ---------- Waitlist ---------- */
  var wl = document.querySelector("[data-waitlist]");
  if (wl) {
    var wrap = wl.closest("[data-waitlist-wrap]");
    var wlStatus = wl.querySelector(".form__status");
    var wlBtn = wl.querySelector("button[type=submit]");

    wl.addEventListener("submit", function (e) {
      e.preventDefault();
      say(wlStatus, "");
      var el = wl.elements, ok = true;
      if (!el.name.value.trim()) { setError(wl, el.name, "Please tell us your name."); ok = false; } else setError(wl, el.name);
      if (!EMAIL_RE.test(el.email.value.trim())) { setError(wl, el.email, "Please enter a valid email address."); ok = false; } else setError(wl, el.email);
      if (!el.city.value.trim()) { setError(wl, el.city, "Please tell us your city."); ok = false; } else setError(wl, el.city);
      if (!el.consent.checked) { setError(wl, el.consent, "Please agree to the Privacy Policy to join."); ok = false; } else setError(wl, el.consent);
      if (!ok) return focusFirstError(wl);
      if (el["bot-field"] && el["bot-field"].value) return; // spam trap

      var data = new FormData(wl);
      setBusy(wlBtn, true, "Joining…");

      function done() {
        wrap.classList.add("is-submitted");
        var s = wrap.querySelector(".form-success");
        if (s) { s.setAttribute("tabindex", "-1"); s.focus(); }
      }
      function fail(msg) {
        setBusy(wlBtn, false, "Join the waitlist");
        say(wlStatus, msg || "Something went wrong. Please try again in a moment.");
      }

      var req;
      if (WAITLIST_ENDPOINT) {
        req = fetch(WAITLIST_ENDPOINT, { method: "POST", headers: { Accept: "application/json" }, body: data })
          .then(function (res) { if (!res.ok) throw new Error("server"); });
      } else if (HAS_SUPABASE) {
        req = getClient().then(function (c) {
          return c.from("waitlist").insert({
            name: el.name.value.trim().slice(0, 120),
            email: el.email.value.trim().toLowerCase(),
            city: el.city.value.trim().slice(0, 80),
            consent: true
          });
        }).then(function (r) {
          // 23505 = this email is already on the list — treat as success.
          if (r.error && r.error.code !== "23505") throw r.error;
        });
      } else if (isLocal) {
        console.info("[KLYR] Local preview — waitlist submission not sent:", Object.fromEntries(data));
        req = new Promise(function (r) { setTimeout(r, 600); });
      } else if (/\.netlify\.app$/.test(host)) {
        // Netlify Forms (only works when hosted on Netlify)
        req = fetch("/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(data).toString() })
          .then(function (res) { if (!res.ok) throw new Error("server"); });
      } else {
        // Hosted somewhere with no waitlist service connected yet (e.g. GitHub Pages before Supabase is set up)
        req = Promise.reject(new Error("not-connected"));
      }
      req.then(done).catch(function (err) {
        console.error("[KLYR] waitlist", err);
        var m = (err && err.message) || "";
        if (m === "not-connected") return fail("Sign-ups open very soon. Please check back shortly.");
        fail(/network|fetch/i.test(m) ? friendly(err) : null);
      });
    });
  }

  /* ---------- Password show / hide ---------- */
  document.querySelectorAll("[data-toggle-password]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var input = document.getElementById(btn.getAttribute("aria-controls"));
      var show = input.type === "password";
      input.type = show ? "text" : "password";
      btn.textContent = show ? "Hide" : "Show";
      btn.setAttribute("aria-pressed", String(show));
    });
  });

  /* ---------- Auth tabs ---------- */
  var tabs = document.querySelectorAll('[role="tab"]');
  function selectTab(tab, focus) {
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
    });
    if (focus) tab.focus();
    history.replaceState(null, "", tab.id === "tab-signup" ? "#signup" : location.pathname);
  }
  tabs.forEach(function (tab, i) {
    tab.addEventListener("click", function () { selectTab(tab); });
    tab.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        selectTab(tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length], true);
      }
    });
  });
  document.querySelectorAll("[data-switch-tab]").forEach(function (a) {
    a.addEventListener("click", function (e) {
      e.preventDefault();
      selectTab(document.getElementById(a.getAttribute("data-switch-tab")), true);
    });
  });
  if (tabs.length && location.hash === "#signup") selectTab(document.getElementById("tab-signup"));

  /* =========================================================
     Accounts
     ========================================================= */
  var NOT_LIVE =
    'KLYR accounts open at launch. Until then, <a class="text-link" href="waitlist.html">join the waitlist</a> to be first in line.';

  // action(form) resolves to { redirect: "page.html" } or { message: "text" }
  function authForm(form, validate, action) {
    if (!form) return;
    var status = form.querySelector(".form__status");
    var btn = form.querySelector("button[type=submit]");
    var label = btn.querySelector("span").textContent;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      say(status, "");
      if (!validate(form)) return focusFirstError(form);
      if (!HAS_SUPABASE) return say(status, NOT_LIVE, true);
      setBusy(btn, true, "Please wait…");
      action(form).then(function (result) {
        if (result && result.redirect) return location.assign(result.redirect);
        setBusy(btn, false, label);
        if (result && result.message) say(status, result.message);
      }).catch(function (err) {
        setBusy(btn, false, label);
        say(status, friendly(err));
      });
    });
  }

  /* ---------- Log in ---------- */
  var loginForm = document.querySelector("[data-login]");
  authForm(loginForm, function (f) {
    var ok = true, el = f.elements;
    if (!EMAIL_RE.test(el.email.value.trim())) { setError(f, el.email, "Please enter a valid email address."); ok = false; } else setError(f, el.email);
    if (!el.password.value) { setError(f, el.password, "Please enter your password."); ok = false; } else setError(f, el.password);
    return ok;
  }, function (f) {
    var el = f.elements;
    return getClient(el.remember.checked).then(function (c) {
      return c.auth.signInWithPassword({ email: el.email.value.trim(), password: el.password.value });
    }).then(function (r) {
      if (r.error) throw r.error;
      return { redirect: "account.html" };
    });
  });

  /* ---------- Sign up ---------- */
  authForm(document.querySelector("[data-signup]"), function (f) {
    var ok = true, el = f.elements;
    if (!el.name.value.trim()) { setError(f, el.name, "Please tell us your name."); ok = false; } else setError(f, el.name);
    if (!EMAIL_RE.test(el.email.value.trim())) { setError(f, el.email, "Please enter a valid email address."); ok = false; } else setError(f, el.email);
    if (!strongPassword(el.password.value)) { setError(f, el.password, PW_RULE); ok = false; } else setError(f, el.password);
    if (!el.terms.checked) { setError(f, el.terms, "Please agree to the Terms and Privacy Policy."); ok = false; } else setError(f, el.terms);
    return ok;
  }, function (f) {
    var el = f.elements, email = el.email.value.trim();
    return getClient(true).then(function (c) {
      return c.auth.signUp({
        email: email,
        password: el.password.value,
        options: { data: { full_name: el.name.value.trim().slice(0, 120) }, emailRedirectTo: siteUrl("account.html") }
      });
    }).then(function (r) {
      if (r.error) throw r.error;
      if (r.data && r.data.session) return { redirect: "account.html" };
      f.reset();
      return { message: "Almost there! We've sent a confirmation link to " + email + ". Click it to activate your account." };
    });
  });

  /* ---------- Forgot password ---------- */
  var forgot = document.querySelector("[data-forgot]");
  if (forgot && loginForm) {
    forgot.addEventListener("click", function () {
      var status = loginForm.querySelector(".form__status");
      var emailInput = loginForm.elements.email;
      if (!HAS_SUPABASE) return say(status, NOT_LIVE, true);
      var email = emailInput.value.trim();
      if (!EMAIL_RE.test(email)) {
        setError(loginForm, emailInput, "Enter your email address above, then tap “Forgot password?” again.");
        return emailInput.focus();
      }
      setError(loginForm, emailInput);
      forgot.disabled = true;
      getClient().then(function (c) {
        return c.auth.resetPasswordForEmail(email, { redirectTo: siteUrl("reset.html") });
      }).then(function (r) {
        if (r.error) throw r.error;
        say(status, "If an account exists for " + email + ", we've sent a link to reset your password.");
      }).catch(function (err) { say(status, friendly(err)); })
        .then(function () { forgot.disabled = false; });
    });
  }

  /* ---------- Login page: skip if already signed in ---------- */
  if (page === "login" && HAS_SUPABASE) {
    getSession().then(function (s) { if (s) location.replace("account.html"); }).catch(function () {});
  }

  /* ---------- Account page ---------- */
  if (page === "account") {
    var acc = document.querySelector("[data-account]");
    var accLoading = document.querySelector("[data-account-loading]");
    var accStatus = document.querySelector("[data-account-status]");
    if (!HAS_SUPABASE) {
      say(accLoading, NOT_LIVE, true);
    } else {
      getSession().then(function (session) {
        if (!session) return location.replace("login.html");
        var u = session.user, meta = u.user_metadata || {};
        var name = meta.full_name || u.email.split("@")[0];
        document.querySelectorAll("[data-account-name]").forEach(function (n) { n.textContent = name.split(" ")[0]; });
        say(document.querySelector("[data-account-fullname]"), name);
        say(document.querySelector("[data-account-email]"), u.email);
        say(document.querySelector("[data-account-since]"),
          new Date(u.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }));
        accLoading.hidden = true;
        acc.hidden = false;
      }).catch(function (err) { say(accLoading, friendly(err)); });

      var logout = document.querySelector("[data-logout]");
      logout.addEventListener("click", function () {
        logout.disabled = true;
        getClient().then(function (c) { return c.auth.signOut(); })
          .then(function () { location.replace("index.html"); })
          .catch(function (err) { logout.disabled = false; say(accStatus, friendly(err)); });
      });

      var resetBtn = document.querySelector("[data-account-reset]");
      resetBtn.addEventListener("click", function () {
        resetBtn.disabled = true;
        getSession().then(function (s) {
          return getClient().then(function (c) {
            return c.auth.resetPasswordForEmail(s.user.email, { redirectTo: siteUrl("reset.html") });
          }).then(function (r) {
            if (r.error) throw r.error;
            say(accStatus, "We've sent a password reset link to " + s.user.email + ".");
          });
        }).catch(function (err) { say(accStatus, friendly(err)); })
          .then(function () { resetBtn.disabled = false; });
      });
    }
  }

  /* ---------- Reset password page ---------- */
  if (page === "reset") {
    var rf = document.querySelector("[data-reset]");
    var rInvalid = document.querySelector("[data-reset-invalid]");
    var rDone = document.querySelector("[data-reset-done]");
    var rChecking = document.querySelector("[data-reset-checking]");
    function showInvalid() { rChecking.hidden = true; rInvalid.hidden = false; }

    if (!HAS_SUPABASE) {
      showInvalid();
    } else {
      // The link in the email signs the user in temporarily; Supabase reads it from the URL.
      getSession().then(function (s) {
        rChecking.hidden = true;
        if (s) rf.hidden = false; else showInvalid();
      }).catch(showInvalid);

      authForm(rf, function (f) {
        var ok = true, el = f.elements;
        if (!strongPassword(el.password.value)) { setError(f, el.password, PW_RULE); ok = false; } else setError(f, el.password);
        if (el.confirm.value !== el.password.value) { setError(f, el.confirm, "The passwords don't match."); ok = false; } else setError(f, el.confirm);
        return ok;
      }, function (f) {
        return getClient().then(function (c) { return c.auth.updateUser({ password: f.elements.password.value }); })
          .then(function (r) {
            if (r.error) throw r.error;
            rf.hidden = true; rDone.hidden = false;
            return {};
          });
      });
    }
  }
})();
