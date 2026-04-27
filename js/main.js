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

  // ── Tool demo form (echte Google-Daten ueber /api/analyze) ──
  const toolForm  = document.getElementById('tool-demo-form');
  const resultBox = document.getElementById('tool-result');

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
  }

  function buildMetric(label, pct) {
    return `<div class="report-metric">
      <div class="report-metric-label">${escapeHtml(label)}</div>
      <div class="report-metric-bar"><div class="report-metric-fill" style="width:${pct}%"></div></div>
      <div class="report-metric-val">${pct}%</div>
    </div>`;
  }

  function renderError(msg) {
    return `<div style="text-align:center;padding:1.5rem 0;">
      <p style="color:var(--amber);font-weight:600;margin-bottom:0.5rem;">Analyse nicht möglich</p>
      <p style="color:var(--text-secondary);font-size:0.9rem;">${escapeHtml(msg)}</p>
      <p style="color:var(--text-muted);font-size:0.8rem;margin-top:0.75rem;">Tipp: Eingabe um Stadt oder Branche ergänzen, z.B. „Bäckerei Müller München".</p>
    </div>`;
  }

  function renderResult(r) {
    const b = r.business || {};
    const recs = r.recommendations || [];
    const comp = r.competitors || [];
    const score = Math.max(0, Math.min(100, Number(r.score) || 0));
    const aff = r.affiliate || {};

    const badges = [];
    if (b.rating) badges.push(`<span class="badge badge-blue">★ ${b.rating} (${b.reviewCount} Bewertungen)</span>`);
    if (b.photoCount != null) badges.push(`<span class="badge badge-cyan">📸 ${b.photoCount} Fotos</span>`);
    if (b.hasOpeningHours) badges.push(`<span class="badge badge-green">✓ Öffnungszeiten</span>`);
    if (b.website) badges.push(`<span class="badge badge-green">✓ Website</span>`);
    if (!b.hasDescription) badges.push(`<span class="badge badge-amber">⚠ Beschreibung fehlt</span>`);

    const metricsHtml = Object.entries(r.metrics || {})
      .map(([k, v]) => buildMetric(k, v))
      .join('');

    const recsHtml = recs.length
      ? recs.map((rec, i) => `
          <div style="display:flex;align-items:flex-start;gap:0.75rem;font-size:0.875rem;">
            <span style="color:var(--amber);font-weight:700;flex-shrink:0;">${i + 1}.</span>
            <div>
              <div style="color:var(--text-primary);font-weight:600;margin-bottom:0.25rem;">${escapeHtml(rec.title)}</div>
              <div style="color:var(--text-secondary);font-size:0.82rem;">${escapeHtml(rec.detail)}</div>
            </div>
          </div>`).join('')
      : '<p style="color:var(--text-muted);font-size:0.85rem;">Keine kritischen Lücken erkannt – starkes Profil.</p>';

    const compHtml = comp.length
      ? `<div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-md);padding:1rem;margin-bottom:1rem;">
           <div style="font-size:0.78rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:0.75rem;">Top-3-Wettbewerber im Umkreis (3,5 km)</div>
           ${comp.map(c => `
             <div style="display:flex;justify-content:space-between;align-items:center;padding:0.5rem 0;border-top:1px solid var(--border);font-size:0.85rem;">
               <span style="color:var(--text-secondary);">${escapeHtml(c.name)}</span>
               <span style="color:var(--text-primary);font-weight:600;">★ ${c.rating ?? '–'} <span style="color:var(--text-muted);font-weight:400;">· ${c.reviewCount} Bew.</span></span>
             </div>`).join('')}
         </div>`
      : '';

    const affHtml = aff.url ? `
      <div style="margin-top:1.25rem;padding:1rem;border:1px solid var(--border-accent);border-radius:var(--radius-md);background:var(--accent-glow);">
        <div style="font-size:0.72rem;font-weight:600;color:var(--accent-light);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:0.5rem;">Empfehlung · ${escapeHtml(aff.provider || 'Localo')}</div>
        <div style="color:var(--text-primary);font-weight:600;margin-bottom:0.4rem;">${escapeHtml(aff.headline || '')}</div>
        <p style="color:var(--text-secondary);font-size:0.85rem;line-height:1.6;margin-bottom:0.75rem;">${escapeHtml(aff.body || '')}</p>
        <a href="${escapeHtml(aff.url)}" target="_blank" rel="sponsored noopener" class="btn btn-primary btn-sm">Localo testen →</a>
        <p style="color:var(--text-muted);font-size:0.7rem;margin-top:0.6rem;">${escapeHtml(aff.disclaimer || 'Werbe-Hinweis: Affiliate-Link.')}</p>
      </div>` : '';

    const dateStr = r.generatedAt
      ? new Date(r.generatedAt).toLocaleDateString('de-DE')
      : new Date().toLocaleDateString('de-DE');

    return `
      <div class="report-header">
        <div>
          <div class="report-title">${escapeHtml(b.name || 'Analyse')}</div>
          <div style="font-size:0.78rem;color:var(--text-muted);margin-top:0.25rem;">
            ${escapeHtml(b.address || '')} · Erstellt: ${dateStr}
          </div>
        </div>
        <div class="report-score-circle">
          <span class="report-score-num">${score}</span>
          <span class="report-score-sub">/ 100</span>
        </div>
      </div>

      ${badges.length ? `<div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:1.25rem;">${badges.join('')}</div>` : ''}

      <div style="margin-bottom:1.5rem;">
        <div style="font-size:0.78rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:0.875rem;">Profil-Metriken</div>
        <div class="report-metrics">${metricsHtml}</div>
      </div>

      <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-md);padding:1rem;margin-bottom:1rem;">
        <div style="font-size:0.78rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:0.75rem;">Top-3-Handlungsempfehlungen (priorisiert)</div>
        <div style="display:flex;flex-direction:column;gap:0.625rem;">${recsHtml}</div>
      </div>

      ${compHtml}

      ${affHtml}

      <div style="margin-top:1.25rem;padding-top:1rem;border-top:1px solid var(--border);text-align:center;">
        <p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:0.75rem;">
          Diese Analyse zeigt die wichtigsten Hebel. Den vollständigen 30-Tage-Aktionsplan,
          NAP-Audit und detaillierten Wettbewerber-Vergleich erhältst du im persönlichen Report.
        </p>
        <a href="/#produkte" class="btn btn-primary">Vollständigen Report anfragen (47 €) →</a>
      </div>
    `;
  }

  if (toolForm && resultBox) {
    toolForm.addEventListener('submit', async e => {
      e.preventDefault();
      const input = toolForm.querySelector('input[name="business"]');
      const locInput = toolForm.querySelector('input[name="location"]');
      const submitBtn = toolForm.querySelector('[type="submit"]');
      const business = input ? input.value.trim() : '';
      const location = locInput ? locInput.value.trim() : '';
      if (!business) return;

      resultBox.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:2rem 0;">Analyse läuft – wir fragen Google Places & PageSpeed ab …</p>';
      resultBox.style.display = 'block';

      const origLabel = submitBtn ? submitBtn.textContent : '';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Analysiere …';
      }

      try {
        const res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ business, location }),
        });
        const data = await res.json();
        if (!res.ok) {
          resultBox.innerHTML = renderError(data.error || `Fehler ${res.status}`);
        } else {
          resultBox.innerHTML = renderResult(data);
        }
      } catch (err) {
        resultBox.innerHTML = renderError(
          'Verbindungsfehler. Bitte prüfe deine Internetverbindung und versuche es erneut.'
        );
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = origLabel;
        }
      }
    });
  }

})();
