/* ==========================================================================
   Daniel Li — personal site
   Seasons · Apple-style navigation · small interactions
   ========================================================================== */

(function () {
    "use strict";

    var root = document.documentElement;
    var STORAGE_KEY = "dl-season";
    var SEASONS = ["winter", "spring", "summer", "fall"];
    var SEASON_LABEL = { winter: "Winter", spring: "Spring", summer: "Summer", fall: "Fall" };
    var SEASON_RANGE = {
        winter: "Dec 21 – Mar 19",
        spring: "Mar 20 – Jun 20",
        summer: "Jun 21 – Sep 21",
        fall: "Sep 22 – Dec 20"
    };
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    root.classList.add("js");

    /* ----------------------------------------------------------------------
       Seasons
       ---------------------------------------------------------------------- */

    // Northern-hemisphere astronomical seasons (approximate solstice/equinox dates)
    function seasonForDate(d) {
        var md = (d.getMonth() + 1) * 100 + d.getDate();
        if (md >= 1221 || md < 320) return "winter";
        if (md < 621) return "spring";
        if (md < 922) return "summer";
        return "fall";
    }

    function readChoice() {
        try {
            var url = new URLSearchParams(window.location.search).get("season");
            if (url && SEASONS.indexOf(url) !== -1) return url;
        } catch (e) { /* ignore */ }
        try {
            var saved = window.localStorage.getItem(STORAGE_KEY);
            if (saved && SEASONS.indexOf(saved) !== -1) return saved;
        } catch (e) { /* storage unavailable */ }
        return "auto";
    }

    var currentChoice = readChoice();

    function applySeason(choice, persist) {
        currentChoice = choice;
        var season = choice === "auto" ? seasonForDate(new Date()) : choice;
        root.setAttribute("data-season", season);

        if (persist) {
            try {
                if (choice === "auto") window.localStorage.removeItem(STORAGE_KEY);
                else window.localStorage.setItem(STORAGE_KEY, choice);
            } catch (e) { /* storage unavailable */ }
        }

        document.querySelectorAll("[data-season-choice]").forEach(function (btn) {
            btn.setAttribute("aria-pressed", String(btn.getAttribute("data-season-choice") === choice));
        });
        document.querySelectorAll("[data-season-label]").forEach(function (el) {
            el.textContent = SEASON_LABEL[season];
        });
        document.querySelectorAll("[data-season-range]").forEach(function (el) {
            el.textContent = SEASON_RANGE[season];
        });
        document.querySelectorAll("[data-season-mode]").forEach(function (el) {
            el.textContent = choice === "auto"
                ? "Following today's date."
                : "Previewing " + SEASON_LABEL[season].toLowerCase() + ". Choose Automatic to follow the date again.";
        });

        if (sky) sky.setSeason(season);
    }

    document.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-season-choice]");
        if (!btn) return;
        applySeason(btn.getAttribute("data-season-choice"), true);
    });

    /* ----------------------------------------------------------------------
       Global navigation
       ---------------------------------------------------------------------- */

    var gnav = document.querySelector(".gnav");
    var curtain = gnav && gnav.querySelector(".gnav-curtain");
    var scrim = document.querySelector(".gnav-scrim");
    var menuBtn = gnav && gnav.querySelector(".gnav-menu-btn");
    var mobileQuery = window.matchMedia("(max-width: 833px)");
    var openItem = null;
    var openTimer = null;
    var closeTimer = null;

    function isMobile() {
        return mobileQuery.matches;
    }

    function triggersFor(item) {
        return item.querySelectorAll(":scope > .gnav-sub-toggle, :scope > .gnav-icon-btn");
    }

    function setExpanded(item, value) {
        triggersFor(item).forEach(function (t) {
            t.setAttribute("aria-expanded", String(value));
        });
    }

    function openFlyout(item) {
        clearTimeout(closeTimer);
        if (openItem === item) return;
        if (openItem) {
            openItem.classList.remove("is-active");
            setExpanded(openItem, false);
        }
        openItem = item;
        item.classList.add("is-active");
        setExpanded(item, true);

        if (!isMobile()) {
            var panel = item.querySelector(".gnav-panel");
            gnav.classList.add("is-open");
            curtain.style.height = (gnav.offsetHeight + panel.offsetHeight) + "px";
            scrim.classList.add("is-visible");
        }
    }

    function closeFlyout() {
        clearTimeout(openTimer);
        if (!openItem) return;
        openItem.classList.remove("is-active");
        setExpanded(openItem, false);
        openItem = null;
        if (!isMobile()) {
            gnav.classList.remove("is-open");
            curtain.style.height = "";
            scrim.classList.remove("is-visible");
        }
    }

    function setMenu(open) {
        gnav.classList.toggle("is-menu-open", open);
        menuBtn.setAttribute("aria-expanded", String(open));
        menuBtn.setAttribute("aria-label", open ? "Close menu" : "Menu");
        document.body.classList.toggle("is-locked", open);
        if (!open) closeFlyout();
    }

    if (gnav) {
        var hoverItems = gnav.querySelectorAll(".gnav-item[data-menu]");

        // Desktop: hover intent, like apple.com
        hoverItems.forEach(function (item) {
            item.addEventListener("mouseenter", function () {
                if (isMobile()) return;
                clearTimeout(openTimer);
                clearTimeout(closeTimer);
                var delay = openItem ? 0 : 140;
                openTimer = setTimeout(function () { openFlyout(item); }, delay);
            });
            item.addEventListener("mouseleave", function () {
                clearTimeout(openTimer);
            });
        });

        gnav.addEventListener("mouseleave", function () {
            if (isMobile()) return;
            clearTimeout(openTimer);
            closeTimer = setTimeout(closeFlyout, 160);
        });
        gnav.addEventListener("mouseenter", function () {
            clearTimeout(closeTimer);
        });

        // Items with no flyout close any open one
        gnav.querySelectorAll(".gnav-item:not([data-menu]), .gnav-logo").forEach(function (el) {
            el.addEventListener("mouseenter", function () {
                if (!isMobile() && openItem && openItem.classList.contains("gnav-item")) closeFlyout();
            });
        });

        // Chevron toggles (keyboard on desktop, tap on mobile) and the season button
        gnav.querySelectorAll(".gnav-sub-toggle, .gnav-icon-btn[data-flyout]").forEach(function (btn) {
            btn.addEventListener("click", function (e) {
                e.stopPropagation();
                var item = btn.closest("[data-menu]");
                if (openItem === item) {
                    closeFlyout();
                    return;
                }
                if (isMobile() && btn.hasAttribute("data-flyout") && !gnav.classList.contains("is-menu-open")) {
                    setMenu(true);
                }
                openFlyout(item);
                if (isMobile()) {
                    var first = item.querySelector(".gnav-back");
                    if (first) first.focus({ preventScroll: true });
                }
            });
        });

        gnav.querySelectorAll(".gnav-back").forEach(function (btn) {
            btn.addEventListener("click", function () {
                var item = btn.closest("[data-menu]");
                closeFlyout();
                var toggle = item && item.querySelector(".gnav-sub-toggle, .gnav-icon-btn");
                if (toggle) toggle.focus({ preventScroll: true });
                // The season sub-menu was opened straight from the bar: close the whole menu
                if (item && !item.classList.contains("gnav-item")) setMenu(false);
            });
        });

        menuBtn.addEventListener("click", function () {
            setMenu(!gnav.classList.contains("is-menu-open"));
        });

        // Keyboard: Escape closes; leaving the nav with Tab closes
        document.addEventListener("keydown", function (e) {
            if (e.key !== "Escape") return;
            if (openItem) {
                var t = openItem.querySelector(".gnav-sub-toggle, .gnav-icon-btn");
                closeFlyout();
                if (t) t.focus();
            } else if (gnav.classList.contains("is-menu-open")) {
                setMenu(false);
                menuBtn.focus();
            }
        });

        gnav.addEventListener("focusout", function (e) {
            if (isMobile()) return;
            if (openItem && !openItem.contains(e.relatedTarget)) closeFlyout();
        });

        if (scrim) scrim.addEventListener("click", closeFlyout);

        document.addEventListener("click", function (e) {
            if (!isMobile() && openItem && !gnav.contains(e.target)) closeFlyout();
        });

        // Anchor links inside the menu should close it
        gnav.querySelectorAll(".gnav-panel a, .gnav-link").forEach(function (a) {
            a.addEventListener("click", function () {
                closeFlyout();
                if (gnav.classList.contains("is-menu-open")) setMenu(false);
            });
        });

        var onBreakpoint = function () {
            closeFlyout();
            setMenu(false);
            gnav.classList.remove("is-open");
            curtain.style.height = "";
            if (scrim) scrim.classList.remove("is-visible");
        };
        if (mobileQuery.addEventListener) mobileQuery.addEventListener("change", onBreakpoint);
        else mobileQuery.addListener(onBreakpoint);
    }

    /* ----------------------------------------------------------------------
       Local navigation (sticky sub-bar)
       ---------------------------------------------------------------------- */

    var lnav = document.querySelector(".lnav");
    if (lnav) {
        var lnavToggle = lnav.querySelector(".lnav-toggle");
        var setLnav = function (open) {
            lnav.classList.toggle("is-open", open);
            lnavToggle.setAttribute("aria-expanded", String(open));
        };
        lnavToggle.addEventListener("click", function () {
            setLnav(!lnav.classList.contains("is-open"));
        });
        lnav.querySelectorAll(".lnav-links a").forEach(function (a) {
            a.addEventListener("click", function () { setLnav(false); });
        });
        document.addEventListener("click", function (e) {
            if (!lnav.contains(e.target)) setLnav(false);
        });
        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape" && lnav.classList.contains("is-open")) {
                setLnav(false);
                lnavToggle.focus();
            }
        });
    }

    /* ----------------------------------------------------------------------
       Filters (photos, recipes)
       ---------------------------------------------------------------------- */

    document.querySelectorAll("[data-filter-group]").forEach(function (group) {
        var target = document.getElementById(group.getAttribute("data-filter-group"));
        if (!target) return;
        var chips = group.querySelectorAll("[data-filter]");
        chips.forEach(function (chip) {
            chip.addEventListener("click", function () {
                var f = chip.getAttribute("data-filter");
                chips.forEach(function (c) { c.setAttribute("aria-pressed", String(c === chip)); });
                target.querySelectorAll("[data-cat]").forEach(function (item) {
                    item.hidden = !(f === "all" || item.getAttribute("data-cat") === f);
                });
            });
        });
    });

    /* ----------------------------------------------------------------------
       Lightbox (real photos only)
       ---------------------------------------------------------------------- */

    var lightbox = document.querySelector(".lightbox");
    if (lightbox && typeof lightbox.showModal === "function") {
        var lbImg = lightbox.querySelector("img");
        var lbCap = lightbox.querySelector(".lightbox-caption");
        document.querySelectorAll("[data-lightbox]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                var img = btn.querySelector("img");
                lbImg.src = img.currentSrc || img.src;
                lbImg.alt = img.alt;
                lbCap.textContent = btn.getAttribute("data-caption") || img.alt;
                lightbox.showModal();
            });
        });
        lightbox.addEventListener("click", function (e) {
            if (e.target === lightbox || e.target.closest(".lightbox-close")) lightbox.close();
        });
    }

    /* ----------------------------------------------------------------------
       Scroll reveal
       ---------------------------------------------------------------------- */

    var reveals = document.querySelectorAll(".reveal");
    if ("IntersectionObserver" in window && !reduceMotion) {
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add("is-visible");
                    io.unobserve(entry.target);
                }
            });
        }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
        reveals.forEach(function (el) { io.observe(el); });
    } else {
        reveals.forEach(function (el) { el.classList.add("is-visible"); });
    }

    /* ----------------------------------------------------------------------
       Seasonal sky — snow, petals, fireflies or leaves drifting in the hero
       ---------------------------------------------------------------------- */

    var sky = (function () {
        var canvas = document.querySelector(".hero-sky");
        if (!canvas || reduceMotion || !canvas.getContext) return null;

        var ctx = canvas.getContext("2d");
        var host = canvas.parentElement;
        var w = 0, h = 0, dpr = 1;
        var parts = [];
        var season = root.getAttribute("data-season") || "fall";
        var colors = [];
        var running = false;
        var inView = true;
        var raf = 0;
        var last = 0;

        function readColors() {
            var cs = getComputedStyle(root);
            colors = ["--particle-1", "--particle-2", "--particle-3"].map(function (v) {
                return cs.getPropertyValue(v).trim() || "#c4572e";
            });
        }

        function rand(a, b) { return a + Math.random() * (b - a); }

        function make(initial) {
            var p = {
                x: rand(0, w),
                y: initial ? rand(-h, h) : rand(-40, -10),
                rot: rand(0, Math.PI * 2),
                spin: rand(-0.02, 0.02),
                phase: rand(0, Math.PI * 2),
                color: colors[Math.floor(Math.random() * colors.length)]
            };
            if (season === "winter") {
                p.r = rand(1.2, 3.4);
                p.vy = rand(0.25, 0.8);
                p.sway = rand(0.2, 0.6);
                p.alpha = rand(0.55, 0.95);
            } else if (season === "spring") {
                p.r = rand(3, 6);
                p.vy = rand(0.35, 0.8);
                p.vx = rand(0.2, 0.6);
                p.sway = rand(0.4, 1);
                p.alpha = rand(0.6, 0.9);
            } else if (season === "summer") {
                p.y = initial ? rand(0, h) : h + 10;
                p.r = rand(1.2, 2.6);
                p.vy = -rand(0.1, 0.35);
                p.sway = rand(0.3, 0.8);
                p.alpha = 0;
            } else {
                p.r = rand(6, 11);
                p.vy = rand(0.45, 1.1);
                p.sway = rand(0.6, 1.4);
                p.alpha = rand(0.55, 0.85);
                p.spin = rand(-0.03, 0.03);
            }
            return p;
        }

        function count() {
            var base = season === "winter" ? w / 18 : season === "summer" ? w / 34 : w / 48;
            return Math.round(Math.min(season === "winter" ? 70 : 34, Math.max(10, base)));
        }

        function reset() {
            readColors();
            parts = [];
            var n = count();
            for (var i = 0; i < n; i++) parts.push(make(true));
        }

        function resize() {
            dpr = Math.min(window.devicePixelRatio || 1, 2);
            w = host.clientWidth;
            h = host.clientHeight;
            canvas.width = Math.round(w * dpr);
            canvas.height = Math.round(h * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }

        function drawLeaf(p) {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.scale(1, 0.55 + 0.45 * Math.abs(Math.sin(p.phase)));
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.moveTo(0, -p.r);
            ctx.quadraticCurveTo(p.r * 0.9, 0, 0, p.r);
            ctx.quadraticCurveTo(-p.r * 0.9, 0, 0, -p.r);
            ctx.fill();
            ctx.globalAlpha = p.alpha * 0.6;
            ctx.strokeStyle = "rgba(60,30,10,0.35)";
            ctx.lineWidth = 0.7;
            ctx.beginPath();
            ctx.moveTo(0, -p.r * 0.9);
            ctx.lineTo(0, p.r * 1.25);
            ctx.stroke();
            ctx.restore();
        }

        function drawPetal(p) {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.scale(1, 0.4 + 0.5 * Math.abs(Math.sin(p.phase)));
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.ellipse(0, 0, p.r, p.r * 0.62, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        function drawSnow(p) {
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
        }

        function drawFirefly(p) {
            var g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 5);
            g.addColorStop(0, p.color);
            g.addColorStop(1, "rgba(255,240,170,0)");
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r * 5, 0, Math.PI * 2);
            ctx.fill();
        }

        function step(t) {
            raf = requestAnimationFrame(step);
            var dt = Math.min(3, (t - last) / 16.67 || 1);
            last = t;
            ctx.clearRect(0, 0, w, h);

            for (var i = 0; i < parts.length; i++) {
                var p = parts[i];
                p.phase += 0.012 * dt;
                p.rot += p.spin * dt;
                p.y += p.vy * dt;
                p.x += (Math.sin(p.phase) * p.sway + (p.vx || 0)) * dt;

                if (season === "summer") {
                    p.alpha = 0.25 + 0.6 * Math.max(0, Math.sin(p.phase * 2.2));
                    drawFirefly(p);
                    if (p.y < -20) parts[i] = make(false);
                } else {
                    if (season === "winter") drawSnow(p);
                    else if (season === "spring") drawPetal(p);
                    else drawLeaf(p);
                    if (p.y > h + 20 || p.x > w + 30 || p.x < -30) parts[i] = make(false);
                }
            }
            ctx.globalAlpha = 1;
        }

        function start() {
            if (running || !inView || document.hidden) return;
            running = true;
            last = performance.now();
            raf = requestAnimationFrame(step);
        }

        function stop() {
            running = false;
            cancelAnimationFrame(raf);
        }

        resize();
        reset();
        start();

        var resizeTimer;
        window.addEventListener("resize", function () {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function () { resize(); reset(); }, 150);
        });

        document.addEventListener("visibilitychange", function () {
            if (document.hidden) stop(); else start();
        });

        if ("IntersectionObserver" in window) {
            new IntersectionObserver(function (entries) {
                inView = entries[0].isIntersecting;
                if (inView) start(); else stop();
            }).observe(host);
        }

        return {
            setSeason: function (s) {
                if (s === season) return;
                season = s;
                // wait a frame so the new CSS colors are applied before reading them
                requestAnimationFrame(reset);
            }
        };
    })();

    /* ----------------------------------------------------------------------
       Init
       ---------------------------------------------------------------------- */

    applySeason(currentChoice, false);

    document.querySelectorAll("[data-year]").forEach(function (el) {
        el.textContent = new Date().getFullYear();
    });
})();
