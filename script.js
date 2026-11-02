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
       Photos page: stats, featured slider, albums, lightbox
       Everything here is built from photos-data.js (PHOTO_ALBUMS + PHOTO_FEATURED),
       so counts and dates always match the photos that actually exist.
       ---------------------------------------------------------------------- */

    var ALBUMS = window.PHOTO_ALBUMS || [];
    ALBUMS.forEach(function (a) { a.slug = a.folder || a.slug; }); // "folder" = folder name in images/photos
    var FEATURED = window.PHOTO_FEATURED || [];
    var CAT_LABEL = { portraits: "Portraits", shoots: "Shoots", events: "Events", everyday: "Everyday", classwork: "Class Work" };
    var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    var albumIndex = document.getElementById("albums-index");
    var albumView = document.getElementById("album-view");
    var lightbox = document.querySelector(".lightbox");

    function findAlbum(slug) {
        for (var i = 0; i < ALBUMS.length; i++) if (ALBUMS[i].slug === slug) return ALBUMS[i];
        return null;
    }

    function photoSrc(album, p, thumb) {
        return "images/photos/" + encodeURIComponent(album.slug) + "/" + (thumb ? "thumbs/" : "") + encodeURIComponent(p.f) + ".jpg";
    }

    function photoAlt(album, p, i) {
        return (p.t ? p.t + ", from " : "Photo " + (i + 1) + " of " + album.photos.length + " from ") + album.title;
    }

    function plural(n, word) {
        return n + " " + word + (n === 1 ? "" : "s");
    }

    // "2026-03-04" -> {y, m, d} without time-zone surprises
    function parseDay(s) {
        var p = s.split("-");
        return { y: +p[0], m: +p[1] - 1, d: +p[2] };
    }

    function fmtDay(s) {
        var d = parseDay(s);
        return MONTHS[d.m] + " " + d.d + ", " + d.y;
    }

    function photoDate(album, p) {
        return p.d ? fmtDay(p.d) : (album.date || "");
    }

    function albumDate(a) {
        if (a.date) return a.date;
        var ds = a.photos.map(function (p) { return p.d; }).filter(Boolean).sort();
        if (!ds.length) return "";
        var lo = parseDay(ds[0]);
        var hi = parseDay(ds[ds.length - 1]);
        if (ds[0] === ds[ds.length - 1]) return fmtDay(ds[0]);
        if (lo.y === hi.y && lo.m === hi.m) return MONTHS[lo.m] + " " + lo.d + " – " + hi.d + ", " + hi.y;
        if (lo.y === hi.y) return MONTHS[lo.m] + " " + lo.d + " – " + MONTHS[hi.m] + " " + hi.d + ", " + hi.y;
        return fmtDay(ds[0]) + " – " + fmtDay(ds[ds.length - 1]);
    }

    function el(tag, cls, text) {
        var e = document.createElement(tag);
        if (cls) e.className = cls;
        if (text != null) e.textContent = text;
        return e;
    }

    /* --- Stats: every number on the page comes from the data --- */
    var totalPhotos = ALBUMS.reduce(function (n, a) { return n + a.photos.length; }, 0);
    document.querySelectorAll("[data-stat]").forEach(function (s) {
        var k = s.getAttribute("data-stat");
        if (k === "photos") s.textContent = totalPhotos.toLocaleString();
        if (k === "albums") s.textContent = ALBUMS.length;
    });
    document.querySelectorAll("[data-count-for]").forEach(function (s) {
        var k = s.getAttribute("data-count-for");
        var n = ALBUMS.filter(function (a) { return k === "all" || a.cat === k; }).length;
        s.textContent = n;
        var chipBtn = s.closest(".chip");
        if (chipBtn && k !== "all") chipBtn.hidden = n === 0;
    });

    /* --- Lightbox --- */
    var lb = null;
    if (lightbox && typeof lightbox.showModal === "function") {
        lb = (function () {
            var img = lightbox.querySelector(".lb-img");
            var count = lightbox.querySelector(".lb-count");
            var title = lightbox.querySelector(".lb-title");
            var exif = lightbox.querySelector(".lb-exif");
            var prev = lightbox.querySelector(".lb-prev");
            var next = lightbox.querySelector(".lb-next");
            var album = null;
            var index = 0;
            var returnFocus = null;

            function chip(text, label) {
                var li = el("li");
                if (label) li.appendChild(el("span", null, label));
                li.appendChild(document.createTextNode(text));
                return li;
            }

            function preload(i) {
                var p = album.photos[i];
                if (p) new Image().src = photoSrc(album, p, false);
            }

            function show(i) {
                index = Math.max(0, Math.min(album.photos.length - 1, i));
                var p = album.photos[index];
                var fullSrc = photoSrc(album, p, false);
                img.src = photoSrc(album, p, true); // instant, then swap in the full size
                img.alt = photoAlt(album, p, index);
                var full = new Image();
                full.onload = function () {
                    if (album.photos[index] === p) img.src = fullSrc;
                };
                full.src = fullSrc;

                count.textContent = album.title + " · " + (index + 1) + " of " + album.photos.length;
                title.textContent = [p.t, photoDate(album, p)].filter(Boolean).join(" · ");
                title.hidden = !title.textContent;

                exif.innerHTML = "";
                if (p.cam) exif.appendChild(chip(p.cam));
                if (p.lens && p.lens.indexOf(p.cam || "~") === -1) exif.appendChild(chip(p.lens));
                if (p.fl) exif.appendChild(chip(p.fl));
                if (p.ap) exif.appendChild(chip(p.ap));
                if (p.ss) exif.appendChild(chip(p.ss));
                if (p.iso) exif.appendChild(chip(String(p.iso), "ISO"));

                prev.hidden = index === 0;
                next.hidden = index === album.photos.length - 1;
                preload(index + 1);
                preload(index - 1);
            }

            function open(a, i) {
                album = a;
                returnFocus = document.activeElement;
                show(i);
                if (!lightbox.open) lightbox.showModal();
                document.dispatchEvent(new CustomEvent("lightbox:open"));
            }

            prev.addEventListener("click", function () { show(index - 1); });
            next.addEventListener("click", function () { show(index + 1); });

            lightbox.addEventListener("click", function (e) {
                if (e.target === lightbox || e.target.classList.contains("lb-stage") || e.target.closest(".lightbox-close")) {
                    lightbox.close();
                }
            });

            lightbox.addEventListener("keydown", function (e) {
                if (e.key === "ArrowLeft") { e.preventDefault(); show(index - 1); }
                if (e.key === "ArrowRight") { e.preventDefault(); show(index + 1); }
            });

            lightbox.addEventListener("close", function () {
                img.removeAttribute("src");
                document.dispatchEvent(new CustomEvent("lightbox:close"));
                if (returnFocus && returnFocus.focus) returnFocus.focus({ preventScroll: true });
            });

            // Swipe left/right on touch screens
            var startX = null;
            var startY = null;
            lightbox.addEventListener("touchstart", function (e) {
                startX = e.touches[0].clientX;
                startY = e.touches[0].clientY;
            }, { passive: true });
            lightbox.addEventListener("touchend", function (e) {
                if (startX === null) return;
                var dx = e.changedTouches[0].clientX - startX;
                var dy = e.changedTouches[0].clientY - startY;
                if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) show(index + (dx < 0 ? 1 : -1));
                startX = null;
            });

            return { open: open };
        })();
    }

    function openPhoto(a, f) {
        if (!lb) return;
        var i = 0;
        a.photos.forEach(function (p, k) { if (p.f === f) i = k; });
        lb.open(a, i);
    }

    /* --- Featured slider --- */
    var slider = document.querySelector("[data-fslider]");
    if (slider) (function () {
        var slides = FEATURED.map(function (s) {
            var a = findAlbum(s.album);
            var p = a && a.photos.filter(function (x) { return x.f === s.f; })[0];
            return p ? { a: a, p: p } : null;
        }).filter(Boolean);

        var section = slider.closest("section");
        if (!slides.length) { if (section) section.hidden = true; return; }

        var track = slider.querySelector(".fslider-track");
        var dots = slider.querySelector(".fslider-dots");
        var playBtn = slider.querySelector("[data-fslider-play]");
        var DURATION = 6500;
        var current = 0;
        var timer = null;
        var userPaused = reduceMotion;
        var hold = 0; // hover / focus / lightbox
        var slideEls = [];
        var dotEls = [];

        slides.forEach(function (s, i) {
            var a = s.a, p = s.p;
            var art = el("article", "fslide");
            art.setAttribute("role", "group");
            art.setAttribute("aria-roledescription", "slide");
            art.setAttribute("aria-label", (i + 1) + " of " + slides.length + ": " + a.title);

            var frame = el("button", "photo-frame fslide-photo");
            frame.type = "button";
            frame.setAttribute("aria-label", "View " + photoAlt(a, p, a.photos.indexOf(p)) + " full screen");
            var im = el("img");
            im.src = photoSrc(a, p, false);
            im.alt = "";
            im.width = p.w;
            im.height = p.h;
            if (i > 0) im.loading = "lazy";
            frame.appendChild(im);
            frame.addEventListener("click", function () { openPhoto(a, p.f); });

            var info = el("div", "fslide-info");
            info.appendChild(el("span", "eyebrow", "Featured · " + (i + 1) + " of " + slides.length));
            info.appendChild(el("h2", "section-title", p.t || a.title));
            var date = photoDate(a, p);
            if (date) info.appendChild(el("p", "fslide-date", date));
            var meta = el("ul", "photo-meta");
            [["Album", a.title], ["Camera", p.cam], ["Lens", p.lens], ["Focal length", p.fl],
             ["Exposure", [p.ap, p.ss, p.iso ? "ISO " + p.iso : ""].filter(Boolean).join(" · ")]
            ].forEach(function (row) {
                if (!row[1]) return;
                var li = el("li");
                li.appendChild(el("span", null, row[0]));
                li.appendChild(el("span", null, row[1]));
                meta.appendChild(li);
            });
            info.appendChild(meta);
            var more = el("a", "link-more", "See the whole album");
            more.href = "#album-" + encodeURIComponent(a.slug);
            info.appendChild(more);

            art.appendChild(frame);
            art.appendChild(info);
            track.appendChild(art);
            slideEls.push(art);

            var dot = el("button", "fslider-dot");
            dot.type = "button";
            dot.setAttribute("aria-label", "Show featured photo " + (i + 1) + ": " + a.title);
            dot.appendChild(el("span", "fslider-dot-fill"));
            dot.addEventListener("click", function () { go(i, true); });
            dots.appendChild(dot);
            dotEls.push(dot);
        });

        if (slides.length < 2) slider.classList.add("is-single");

        function go(i, user) {
            current = (i + slides.length) % slides.length;
            track.style.transform = "translateX(" + (-100 * current) + "%)";
            slideEls.forEach(function (s, k) {
                var on = k === current;
                s.setAttribute("aria-hidden", String(!on));
                if (on) s.removeAttribute("inert"); else s.setAttribute("inert", "");
            });
            dotEls.forEach(function (d, k) {
                d.classList.toggle("is-active", k === current);
                d.setAttribute("aria-current", k === current ? "true" : "false");
            });
            restart();
        }

        function running() {
            return !userPaused && hold === 0 && !document.hidden && slides.length > 1;
        }

        function restart() {
            clearTimeout(timer);
            slider.classList.remove("is-playing");
            void slider.offsetWidth; // restart the dot's progress animation
            if (running()) {
                slider.classList.add("is-playing");
                timer = setTimeout(function () { go(current + 1); }, DURATION);
            }
        }

        function setHold(delta) {
            hold = Math.max(0, hold + delta);
            if (running()) restart(); else { clearTimeout(timer); slider.classList.remove("is-playing"); }
        }

        function syncPlayBtn() {
            slider.classList.toggle("is-paused", userPaused);
            playBtn.setAttribute("aria-label", userPaused ? "Play slideshow" : "Pause slideshow");
        }

        slider.style.setProperty("--fslider-duration", DURATION + "ms");
        slider.querySelector("[data-fslider-prev]").addEventListener("click", function () { go(current - 1, true); });
        slider.querySelector("[data-fslider-next]").addEventListener("click", function () { go(current + 1, true); });
        playBtn.addEventListener("click", function () {
            userPaused = !userPaused;
            syncPlayBtn();
            restart();
        });

        var viewport = slider.querySelector(".fslider-viewport");
        viewport.addEventListener("mouseenter", function () { setHold(1); });
        viewport.addEventListener("mouseleave", function () { setHold(-1); });
        // Keyboard focus pauses (WCAG 2.2.2); a mouse click on the arrows doesn't
        var focusHeld = false;
        slider.addEventListener("focusin", function (e) {
            var kb = e.target.matches && e.target.matches(":focus-visible");
            if (kb && !focusHeld) { focusHeld = true; setHold(1); }
        });
        slider.addEventListener("focusout", function (e) {
            if (focusHeld && !slider.contains(e.relatedTarget)) { focusHeld = false; setHold(-1); }
        });
        document.addEventListener("lightbox:open", function () { setHold(1); });
        document.addEventListener("lightbox:close", function () { setHold(-1); });
        document.addEventListener("visibilitychange", function () { restart(); });
        slider.addEventListener("keydown", function (e) {
            if (e.key === "ArrowLeft") go(current - 1, true);
            if (e.key === "ArrowRight") go(current + 1, true);
        });

        // Swipe
        var sx = null, sy = null;
        viewport.addEventListener("touchstart", function (e) {
            sx = e.touches[0].clientX; sy = e.touches[0].clientY;
        }, { passive: true });
        viewport.addEventListener("touchend", function (e) {
            if (sx === null) return;
            var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
            if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(current + (dx < 0 ? 1 : -1), true);
            sx = null;
        });

        syncPlayBtn();
        go(0);
    })();

    /* --- Album grid + album view, driven by the URL hash (#album-vienna, #cat-portraits) --- */
    if (albumIndex && albumView && ALBUMS.length) {
        var albumGrid = document.getElementById("album-grid");
        var grid = document.getElementById("album-photos");
        var section = document.getElementById("albums");
        var current = null;

        ALBUMS.forEach(function (a) {
            var cover = a.photos.filter(function (p) { return p.f === a.cover; })[0] || a.photos[0];
            var card = el("a", "album-card reveal");
            card.href = "#album-" + encodeURIComponent(a.slug);
            card.setAttribute("data-cat", a.cat);
            var c = el("div", "album-cover");
            var im = el("img");
            im.src = photoSrc(a, cover, true);
            im.alt = "";
            im.width = cover.w;
            im.height = cover.h;
            im.loading = "lazy";
            im.decoding = "async";
            c.appendChild(im);
            var t = el("div", "album-text");
            t.appendChild(el("span", "album-cat", CAT_LABEL[a.cat] || ""));
            t.appendChild(el("h3", null, a.title));
            var d = albumDate(a);
            if (d) t.appendChild(el("span", "album-date", d));
            t.appendChild(el("span", "album-count", plural(a.photos.length, "photo")));
            card.appendChild(c);
            card.appendChild(t);
            albumGrid.appendChild(card);
        });

        function renderAlbum(a) {
            current = a;
            albumView.querySelector("[data-album-cat]").textContent = CAT_LABEL[a.cat] || "";
            albumView.querySelector("[data-album-title]").textContent = a.title;
            var dateEl = albumView.querySelector("[data-album-date]");
            dateEl.textContent = albumDate(a);
            dateEl.hidden = !dateEl.textContent;

            var cams = [];
            a.photos.forEach(function (p) { if (p.cam && cams.indexOf(p.cam) === -1) cams.push(p.cam); });
            albumView.querySelector("[data-album-meta]").textContent =
                plural(a.photos.length, "photo") + (cams.length ? " · Shot on " + cams.join(" and ") : "");

            var frag = document.createDocumentFragment();
            a.photos.forEach(function (p, i) {
                var b = el("button", "album-photo");
                b.type = "button";
                b.setAttribute("aria-label", "View " + photoAlt(a, p, i));
                var im = el("img");
                im.src = photoSrc(a, p, true);
                im.alt = "";
                im.width = p.w;
                im.height = p.h;
                im.loading = "lazy";
                im.decoding = "async";
                b.appendChild(im);
                b.addEventListener("click", function () { if (lb) lb.open(a, i); });
                frag.appendChild(b);
            });
            grid.innerHTML = "";
            grid.appendChild(frag);

            var k = ALBUMS.indexOf(a);
            var prevA = ALBUMS[(k - 1 + ALBUMS.length) % ALBUMS.length];
            var nextA = ALBUMS[(k + 1) % ALBUMS.length];
            var pl = albumView.querySelector("[data-album-prev]");
            var nl = albumView.querySelector("[data-album-next]");
            pl.href = "#album-" + encodeURIComponent(prevA.slug);
            pl.textContent = prevA.title;
            pl.setAttribute("data-label", "Previous album");
            nl.href = "#album-" + encodeURIComponent(nextA.slug);
            nl.textContent = nextA.title;
            nl.setAttribute("data-label", "Next album");
        }

        function route(initial) {
            var h = decodeURIComponent(window.location.hash.slice(1));
            if (h.indexOf("album-") === 0) {
                var a = findAlbum(h.slice(6));
                if (a) {
                    if (current !== a) renderAlbum(a);
                    albumIndex.hidden = true;
                    albumView.hidden = false;
                    document.title = a.title + " · Photos · Daniel Li";
                    section.scrollIntoView({ behavior: initial || reduceMotion ? "auto" : "smooth" });
                    albumView.querySelector("[data-album-title]").focus({ preventScroll: true });
                    return;
                }
            }
            albumIndex.hidden = false;
            albumView.hidden = true;
            document.title = "Photos · Daniel Li";
            if (h.indexOf("cat-") === 0) {
                var chipBtn = albumIndex.querySelector('[data-filter="' + h.slice(4) + '"]');
                if (chipBtn) chipBtn.click();
                section.scrollIntoView({ behavior: initial || reduceMotion ? "auto" : "smooth" });
            }
        }

        window.addEventListener("hashchange", function () { route(false); });
        route(true);
    }

    /* ----------------------------------------------------------------------
       Recipes: the grid on recipes.html and each recipe page (recipe.html#id)
       are built from recipes-data.js.
       ---------------------------------------------------------------------- */

    var RECIPES = window.RECIPES || [];
    var RECIPE_CAT = { mains: "Main", sides: "Side", desserts: "Dessert", breakfast: "Breakfast" };

    function recipePic(r, cls) {
        if (r.photo) {
            var wrap = el("div", cls || "dish-photo");
            var img = document.createElement("img");
            img.src = "images/food/" + r.photo;
            img.alt = r.alt || r.name || "";
            img.width = 1600; img.height = 1067;
            img.decoding = "async";
            wrap.appendChild(img);
            return wrap;
        }
        var tpl = document.getElementById("recipe-ph");
        return tpl ? tpl.content.firstElementChild.cloneNode(true) : el("div");
    }

    var recipeGrid = document.getElementById("recipe-grid");
    if (recipeGrid) {
        RECIPES.forEach(function (r) {
            var card = el("a", "recipe-card reveal");
            card.href = "recipe.html#" + encodeURIComponent(r.id);
            card.setAttribute("data-cat", r.category || "");
            var pic = recipePic(r);
            var im = pic.querySelector && pic.querySelector("img");
            if (im) im.loading = "lazy";
            card.appendChild(pic);
            var body = el("div", "recipe-body");
            body.appendChild(el("span", "recipe-cat", RECIPE_CAT[r.category] || r.category || ""));
            body.appendChild(el("h3", null, r.name || "Recipe name"));
            body.appendChild(el("span", "link-more", "See ingredients"));
            card.appendChild(body);
            recipeGrid.appendChild(card);
        });
        // Hide filter buttons for categories that have no recipes yet
        document.querySelectorAll('[data-filter-group="recipe-grid"] [data-filter]').forEach(function (chip) {
            var f = chip.getAttribute("data-filter");
            if (f === "all") return;
            chip.hidden = !RECIPES.some(function (r) { return r.category === f; });
        });
    }

    if (document.querySelector("[data-recipe-name]")) {
        var showRecipe = function () {
            var id = decodeURIComponent(location.hash.replace(/^#/, ""));
            var r = null;
            for (var i = 0; i < RECIPES.length; i++) if (RECIPES[i].id === id) r = RECIPES[i];
            if (!r) r = RECIPES[0];
            if (!r) return;
            var name = r.name || "Recipe name";
            document.title = name + " · Daniel Li";
            document.querySelector("[data-recipe-name]").textContent = name;
            document.querySelector("[data-recipe-cat]").textContent = RECIPE_CAT[r.category] || r.category || "";
            var media = document.querySelector("[data-recipe-photo]");
            media.innerHTML = "";
            media.appendChild(recipePic(r, "dish-photo dish-photo--feature"));

            var ul = document.querySelector("[data-recipe-ingredients]");
            ul.innerHTML = "";
            var ing = (r.ingredients || []).filter(function (x) { return String(x).trim(); });
            if (ing.length) ing.forEach(function (x) { ul.appendChild(el("li", null, x)); });
            else ul.appendChild(el("li", "placeholder-text", "Ingredients coming soon."));

            var steps = (r.steps || []).filter(function (x) { return String(x).trim(); });
            var ol = document.querySelector("[data-recipe-steps]");
            ol.innerHTML = "";
            steps.forEach(function (x) { ol.appendChild(el("li", null, x)); });
            document.querySelector("[data-recipe-steps-wrap]").hidden = !steps.length;
        };
        window.addEventListener("hashchange", function () { showRecipe(); window.scrollTo(0, 0); });
        showRecipe();
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
