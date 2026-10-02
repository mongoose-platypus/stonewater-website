/* =============================================================
   STONEWATER PARTNERS — interactions
   Deliberately small: sticky nav, adaptive nav colour,
   mobile drawer, scroll reveals. No dependencies.
   ============================================================= */
(function () {
  'use strict';

  var nav = document.getElementById('nav');
  var toggle = document.getElementById('navToggle');
  var drawer = document.getElementById('navDrawer');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- photography fallback ----------
     Real photographs are referenced by filename. Until they are dropped into
     assets/img/, each falls back to its abstract SVG stand-in rather than
     rendering as a broken image. Remove this block once photos are in place. */
  function applyFallback(img) {
    if (!img || img.tagName !== 'IMG') return;
    var fallback = img.getAttribute('data-fallback');
    if (!fallback || img.getAttribute('src') === fallback) return;
    img.setAttribute('src', fallback);
    var note = img.parentNode && img.parentNode.querySelector('.media__note');
    if (note) note.textContent = 'Awaiting photograph — ' + (img.getAttribute('data-slot') || 'image slot');
  }

  document.addEventListener('error', function (e) { applyFallback(e.target); }, true);

  // An eager hero can fail before this deferred script runs, and the error
  // event does not fire again. Sweep for already-failed images on init.
  Array.prototype.forEach.call(document.querySelectorAll('img[data-fallback]'), function (img) {
    if (img.complete && img.naturalWidth === 0) applyFallback(img);
  });

  /* ---------- current year ---------- */
  var year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());

  /* ---------- sticky state ---------- */
  function onScroll() {
    if (!nav) return;
    nav.classList.toggle('is-stuck', window.scrollY > 24);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- adaptive nav colour ----------
     Each section declares data-nav="dark|light" describing its own background;
     whichever sits under the navbar wins.

     This is measured geometrically rather than with an IntersectionObserver.
     The observer approach needed a rootMargin derived from window.innerHeight,
     which is unreliable inside an iframe (the published artifact), so the bar
     could render mis-themed until the first scroll. */
  var zones = Array.prototype.slice.call(document.querySelectorAll('[data-nav]'));

  function updateNavTheme() {
    if (!nav || !zones.length) return;
    var probe = nav.offsetHeight + 4;          // a point just below the bar
    var current = null;
    for (var i = 0; i < zones.length; i++) {
      var r = zones[i].getBoundingClientRect();
      if (r.top <= probe && r.bottom > probe) current = zones[i];
    }
    if (!current) current = (window.scrollY < 10) ? zones[0] : zones[zones.length - 1];
    var theme = current.getAttribute('data-nav');
    if (nav.getAttribute('data-theme') !== theme) nav.setAttribute('data-theme', theme);
  }

  var navTick = false;
  function queueNavTheme() {
    if (navTick) return;
    navTick = true;
    window.requestAnimationFrame(function () { navTick = false; updateNavTheme(); });
  }

  window.addEventListener('scroll', queueNavTheme, { passive: true });
  window.addEventListener('resize', queueNavTheme);
  // Images and fonts shift layout after parse, so re-check once they land.
  window.addEventListener('load', updateNavTheme);
  updateNavTheme();

  /* ---------- mobile drawer ---------- */
  function setMenu(open) {
    if (!nav || !toggle) return;
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) nav.setAttribute('data-theme', 'dark');
  }

  if (toggle) {
    toggle.addEventListener('click', function () {
      setMenu(!nav.classList.contains('is-open'));
    });
  }

  if (drawer) {
    drawer.addEventListener('click', function (e) {
      if (e.target.closest('a')) setMenu(false);
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && nav && nav.classList.contains('is-open')) setMenu(false);
  });

  /* ---------- testimonial carousel ----------
     Auto-advances, but pauses on hover, on keyboard focus, and when the tab is
     hidden. Under prefers-reduced-motion it becomes a plain manual carousel:
     no autoplay, no sliding transition. */
  (function () {
    var root = document.getElementById('quotes');
    if (!root) return;

    var track = document.getElementById('quotesTrack');
    var slides = Array.prototype.slice.call(track.children);
    var dots = Array.prototype.slice.call(root.querySelectorAll('.quotes__dot'));
    var dwell = parseInt(root.getAttribute('data-dwell'), 10) || 7000;
    var index = 0, timer = null, paused = false;

    root.style.setProperty('--quote-dwell', dwell + 'ms');

    function render() {
      track.style.transform = 'translateX(' + (-index * 100) + '%)';
      slides.forEach(function (s, i) {
        s.classList.toggle('is-active', i === index);
        // Inactive slides are visually dimmed and off-viewport; hide them from AT.
        s.setAttribute('aria-hidden', i === index ? 'false' : 'true');
      });
      dots.forEach(function (d, i) {
        d.setAttribute('aria-selected', i === index ? 'true' : 'false');
      });
      restartProgress();
    }

    // The active dot doubles as the dwell indicator — replay its fill animation
    // whenever the slide changes or playback resumes.
    function restartProgress() {
      dots.forEach(function (d) { d.classList.remove('is-filling'); });
      if (reduce || paused) return;
      var active = dots[index];
      if (!active) return;
      void active.offsetWidth;                   // force reflow so the animation replays
      active.classList.add('is-filling');
    }

    function go(n) {
      index = (n + slides.length) % slides.length;
      render();
      schedule();
    }

    function schedule() {
      window.clearTimeout(timer);
      if (reduce || paused) return;
      timer = window.setTimeout(function () { go(index + 1); }, dwell);
    }

    function pause() {
      paused = true;
      window.clearTimeout(timer);
      dots.forEach(function (d) { d.classList.remove('is-filling'); });
    }
    function resume() {
      if (!paused) return;
      paused = false;
      restartProgress();
      schedule();
    }

    root.querySelectorAll('.quotes__btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        go(index + parseInt(btn.getAttribute('data-dir'), 10));
      });
    });
    dots.forEach(function (d, i) { d.addEventListener('click', function () { go(i); }); });

    root.addEventListener('mouseenter', pause);
    root.addEventListener('mouseleave', resume);
    root.addEventListener('focusin', pause);
    root.addEventListener('focusout', function (e) {
      if (!root.contains(e.relatedTarget)) resume();
    });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        window.clearTimeout(timer);
        dots.forEach(function (d) { d.classList.remove('is-filling'); });
      } else if (!paused) {
        restartProgress(); schedule();
      }
    });

    root.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1); }
    });

    // Touch swipe
    var startX = null;
    root.addEventListener('touchstart', function (e) { startX = e.touches[0].clientX; pause(); }, { passive: true });
    root.addEventListener('touchend', function (e) {
      if (startX === null) return;
      var dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 45) { go(index + (dx < 0 ? 1 : -1)); }
      startX = null; paused = false; schedule();
    }, { passive: true });

    render();
    schedule();
  })();

  /* ---------- hero parallax ----------
     The hero image travels slower than the page. The wrapper has 7% of extra
     height top and bottom (see CSS) so it can move without exposing an edge. */
  (function () {
    if (reduce) return;
    var media = document.querySelector('.hero__media, .page-hero__media');
    var host = media && media.parentNode;
    if (!media || !host) return;

    var ticking = false;
    function park() {
      var r = host.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) return;   // off screen, skip
      var travelled = Math.min(Math.max(-r.top, 0), r.height);
      media.style.transform = 'translate3d(0,' + (travelled * 0.16).toFixed(1) + 'px,0)';
    }
    function queue() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () { ticking = false; park(); });
    }
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue);
    park();
  })();

  /* ---------- counting statistics ----------
     Plain integers count up once, when first scrolled into view. Anything that
     is not a plain number (an em dash placeholder, "3 mo", "2.4x") is left
     exactly as written. */
  (function () {
    var stats = Array.prototype.slice.call(document.querySelectorAll('.stat__n, .fig__v'));
    if (!stats.length) return;

    var numeric = stats.filter(function (el) { return /^\d{1,4}$/.test(el.textContent.trim()); });
    if (!numeric.length || reduce || !('IntersectionObserver' in window)) return;

    function run(el) {
      var target = parseInt(el.textContent.trim(), 10);
      var started = null;
      var dur = 1100;
      function step(ts) {
        if (!started) started = ts;
        var p = Math.min((ts - started) / dur, 1);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = String(Math.round(target * eased));
        if (p < 1) window.requestAnimationFrame(step);
        else el.textContent = String(target);
      }
      window.requestAnimationFrame(step);
    }

    var seen = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { run(e.target); obs.unobserve(e.target); }
      });
    }, { threshold: 0.6 });
    numeric.forEach(function (el) { seen.observe(el); });
  })();

  /* ---------- section eyebrow rules ----------
     Each eyebrow's hairline draws in as it comes into view. Under reduced
     motion, or without an observer, they are shown immediately. */
  (function () {
    var eyebrows = Array.prototype.slice.call(document.querySelectorAll('.eyebrow'));
    if (!eyebrows.length) return;
    if (reduce || !('IntersectionObserver' in window)) {
      eyebrows.forEach(function (e) { e.classList.add('is-in'); });
      return;
    }
    var obs = new IntersectionObserver(function (entries, o) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); o.unobserve(e.target); }
      });
    }, { threshold: 0.4 });
    eyebrows.forEach(function (e) {
      if (e.getBoundingClientRect().top < window.innerHeight) e.classList.add('is-in');
      else obs.observe(e);
    });
  })();

  /* ---------- exclusive accordions ----------
     Only one panel in a given .acc group stays open: opening a second closes
     the first. The toggle event does not bubble, so each item is bound on its
     own. Without JS every panel still opens and closes independently. */
  (function () {
    var groups = document.querySelectorAll('.acc');
    Array.prototype.forEach.call(groups, function (group) {
      var items = Array.prototype.slice.call(group.querySelectorAll(':scope > details'));
      items.forEach(function (item) {
        item.addEventListener('toggle', function () {
          if (!item.open) return;
          items.forEach(function (other) {
            if (other !== item && other.open) other.open = false;
          });
        });
      });
    });
  })();

  /* ---------- reading progress ----------
     The hairline at the top of an article tracks how far through its body the
     reader is - from the first line reaching the bar to the last line leaving
     the viewport. Only pages that include .progress run this. */
  (function () {
    var bar = document.querySelector('.progress span');
    var body = document.querySelector('.article__body');
    if (!bar || !body) return;
    var ticking = false;
    function measure() {
      ticking = false;
      var r = body.getBoundingClientRect();
      var start = r.top - (nav ? nav.offsetHeight : 0);
      var span = r.height - window.innerHeight * 0.6;
      var p = span > 0 ? Math.min(Math.max(-start / span, 0), 1) : 1;
      bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
    }
    function queue() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(measure);
    }
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue);
    measure();
  })();

  /* ---------- staggered groups ----------
     Children of a card grid or list resolve in sequence rather than all at
     once, one --stagger step apart and never more than six steps in total. */
  (function () {
    if (reduce) return;
    var step = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--stagger')) || 70;
    var grids = document.querySelectorAll('.ind-grid, .svc-grid, .di-apart, .people, .eng-pair, .ins-grid, .career-points, .detail-list, .cs-list');
    Array.prototype.forEach.call(grids, function (grid) {
      Array.prototype.forEach.call(grid.children, function (child, i) {
        if (i === 0 || !child.hasAttribute('data-reveal')) return;
        child.style.transitionDelay = Math.min(i, 6) * step + 'ms';
      });
    });
  })();

  /* A reveal delay must not outlive the reveal: left in place it would also
     delay every later hover transition on that element. Once an element has
     finished arriving it is marked settled, which zeroes its delay. */
  function settle(el) {
    var done = false;
    function finish() { if (!done) { done = true; el.classList.add('is-settled'); } }
    el.addEventListener('transitionend', function (e) {
      if (e.target === el && (e.propertyName === 'opacity' || e.propertyName === 'clip-path')) finish();
    });
    window.setTimeout(finish, 1800);   // in case no transition runs at all
  }

  /* ---------- scroll reveals ---------- */
  var revealables = Array.prototype.slice.call(document.querySelectorAll('[data-reveal]'));

  function revealAll() {
    revealables.forEach(function (el) { el.classList.add('is-in'); settle(el); });
  }

  if (reduce || !('IntersectionObserver' in window)) {
    revealAll();
  } else {
    var revealer = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          settle(entry.target);
          obs.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    // Anything already on screen at load reveals immediately — the first paint
    // should never wait on an observer callback. Hero content is always
    // revealed regardless of position: on a short viewport (laptop, landscape
    // phone) a second paragraph can sit below the fold and would otherwise
    // stay invisible until the visitor scrolls.
    var pending = [];
    revealables.forEach(function (el) {
      var aboveFold = el.getBoundingClientRect().top < window.innerHeight;
      var inHero = !!(el.closest && el.closest('.hero, .page-hero'));
      if (aboveFold || inHero) {
        el.classList.add('is-in');
        settle(el);
      } else {
        pending.push(el);
        revealer.observe(el);
      }
    });

    // Failsafe: content must never be stuck hidden. Two seconds after load, and
    // again whenever scrolling settles, anything on screen that the observer
    // has not revealed is revealed directly. (The one-off check alone missed
    // elements reached later by scrolling.)
    function sweep() {
      pending = pending.filter(function (el) {
        if (el.classList.contains('is-in')) return false;
        var r = el.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0) {
          el.classList.add('is-in'); settle(el); revealer.unobserve(el);
          return false;
        }
        return true;
      });
      if (!pending.length) window.removeEventListener('scroll', onScrollIdle);
    }
    var idle = null;
    function onScrollIdle() {
      window.clearTimeout(idle);
      idle = window.setTimeout(sweep, 700);
    }
    window.addEventListener('scroll', onScrollIdle, { passive: true });
    window.setTimeout(sweep, 2000);
  }
})();
