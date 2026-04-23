/* ================================================
   SICHTBARLOKAL.DE – Main JavaScript
   ================================================ */

(function () {
  'use strict';

  // ── Navigation scroll effect ──────────────────────
  const nav         = document.querySelector('.nav');
  const scrollTopBtn = document.querySelector('.scroll-top');
  const hamburger   = document.querySelector('.nav-hamburger');
  const mobileNav   = document.querySelector('.nav-mobile');

  function handleScroll() {
    if (!nav) return;
    nav.classList.toggle('scrolled', window.scrollY > 20);
    if (scrollTopBtn) {
      scrollTopBtn.classList.toggle('visible', window.scrollY > 500);
    }
  }

  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll();

  // ── Mobile nav ────────────────────────────────────
  if (hamburger && mobileNav) {
    hamburger.addEventListener('click', () => {
      hamburger.classList.toggle('open');
      mobileNav.classList.toggle('open');
    });
    mobileNav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        hamburger.classList.remove('open');
        mobileNav.classList.remove('open');
      });
    });
  }

  // ── Scroll to top ─────────────────────────────────
  if (scrollTopBtn) {
    scrollTopBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  // ── Smooth scroll anchors ─────────────────────────
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', e => {
      const href = anchor.getAttribute('href');
      if (href === '#') return;
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        const offset = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-height')) || 72;
        const top = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });

  // ── Intersection Observer – fade-in ───────────────
  const fadeObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        fadeObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -48px 0px' });

  document.querySelectorAll('.fade-in').forEach(el => fadeObserver.observe(el));

  // ── Counter animation ─────────────────────────────
  function animateCounter(el) {
    const target   = parseFloat(el.dataset.target);
    const suffix   = el.dataset.suffix || '';
    const decimals = el.dataset.decimals ? parseInt(el.dataset.decimals) : 0;
    const duration = 1800;
    const startTime = performance.now();

    function tick(now) {
      const progress = Math.min((now - startTime) / duration, 1);
      const ease     = 1 - Math.pow(1 - progress, 3);
      const value    = (target * ease).toFixed(decimals);
      el.textContent = value + suffix;
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  const counterObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        counterObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  document.querySelectorAll('[data-counter]').forEach(el => counterObserver.observe(el));

  // ── Active nav link (sections) ────────────────────
  const sections  = document.querySelectorAll('section[id]');
  const navLinks  = document.querySelectorAll('.nav-links a');

  function updateActiveNav() {
    let current = '';
    sections.forEach(sec => {
      if (window.scrollY >= sec.offsetTop - 120) current = sec.id;
    });
    navLinks.forEach(link => {
      link.classList.toggle('active', link.getAttribute('href') === '#' + current);
    });
  }
  window.addEventListener('scroll', updateActiveNav, { passive: true });

  // ── Blog category filter ──────────────────────────
  const filters   = document.querySelectorAll('.blog-filter');
  const blogCards = document.querySelectorAll('.blog-card[data-cat]');

  filters.forEach(btn => {
    btn.addEventListener('click', () => {
      filters.forEach(f => f.classList.remove('active'));
      btn.classList.add('active');
      const cat = btn.dataset.filter;
      blogCards.forEach(card => {
        const show = cat === 'all' || card.dataset.cat === cat;
        card.style.display = show ? 'flex' : 'none';
      });
    });
  });

  // ── Contact form (Netlify) ────────────────────────
  const contactForm  = document.getElementById('contact-form');
  const successPanel = document.querySelector('.form-success');

  if (contactForm) {
    contactForm.addEventListener('submit', async e => {
      e.preventDefault();

      const submitBtn  = contactForm.querySelector('[type="submit"]');
      const origLabel  = submitBtn.textContent;
      submitBtn.textContent = 'Wird gesendet …';
      submitBtn.disabled    = true;

      try {
        const data = new FormData(contactForm);
        await fetch('/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(data).toString(),
        });
        contactForm.style.display   = 'none';
        if (successPanel) successPanel.classList.add('show');
      } catch {
        submitBtn.textContent = origLabel;
        submitBtn.disabled    = false;
        alert('Fehler beim Senden. Bitte versuche es erneut oder schreib uns direkt per E-Mail.');
      }
    });
  }

  // ── Tool demo form ────────────────────────────────
  const toolForm  = document.getElementById('tool-demo-form');
  const resultBox = document.getElementById('tool-result');

  if (toolForm && resultBox) {
    toolForm.addEventListener('submit', e => {
      e.preventDefault();
      const input = toolForm.querySelector('input[name="business"]');
      if (!input || !input.value.trim()) return;

      resultBox.style.display = 'none';
      resultBox.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:2rem 0;">Analyse läuft …</p>';
      resultBox.style.display = 'block';

      setTimeout(() => {
        resultBox.innerHTML = `
          <div class="report-header">
            <div>
              <div class="report-title">Analyse: ${input.value.trim()}</div>
              <div style="font-size:0.78rem;color:var(--text-muted);margin-top:0.25rem;">Erstellt: ${new Date().toLocaleDateString('de-DE')}</div>
            </div>
            <div class="report-score-circle">
              <span class="report-score-num">74</span>
              <span class="report-score-sub">/ 100</span>
            </div>
          </div>
          <div class="report-metrics">
            ${buildMetric('GMB-Profil-Vollständigkeit', 88)}
            ${buildMetric('Bewertungsanzahl', 62)}
            ${buildMetric('Keyword-Optimierung', 55)}
            ${buildMetric('Foto-Qualität', 80)}
            ${buildMetric('Posting-Aktivität', 40)}
          </div>
          <div style="margin-top:1.5rem;padding-top:1rem;border-top:1px solid var(--border);">
            <p style="font-size:0.82rem;color:var(--text-secondary);">
              Dies ist eine Demo-Vorschau. Der vollständige KI-Report enthält detaillierte Handlungsempfehlungen, Wettbewerber-Vergleich und einen 30-Tage-Aktionsplan.
            </p>
          </div>`;
      }, 1800);
    });
  }

  function buildMetric(label, pct) {
    return `<div class="report-metric">
      <div class="report-metric-label">${label}</div>
      <div class="report-metric-bar"><div class="report-metric-fill" style="width:${pct}%"></div></div>
      <div class="report-metric-val">${pct}%</div>
    </div>`;
  }

})();
