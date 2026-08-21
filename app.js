(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const toast = document.querySelector('.toast');
  let toastTimer;

  const themeToggle = document.querySelector('.theme-toggle');
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const siteHeader = document.querySelector('body > header');

  const applyTheme = (theme, { persist = true } = {}) => {
    const next = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    themeToggle?.setAttribute('aria-label', next === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    if (themeMeta) themeMeta.setAttribute('content', next === 'dark' ? '#181619' : '#a282a2');
    if (persist) localStorage.setItem('mollemira-theme', next);
  };

  applyTheme(document.documentElement.dataset.theme || 'light', { persist: false });

  themeToggle?.addEventListener('click', () => {
    themeToggle.classList.remove('theme-flip');
    void themeToggle.offsetWidth;
    themeToggle.classList.add('theme-flip');
    if (typeof themeToggle.animate === 'function') {
      themeToggle.getAnimations().forEach(animation => animation.cancel());
      const tapAnimation = themeToggle.animate(
        [
          { transform: 'scale(1) rotate(0deg)' },
          { transform: 'scale(.86) rotate(9deg)', offset: .45 },
          { transform: 'scale(1) rotate(0deg)' }
        ],
        { duration: reduceMotion ? 180 : 460, easing: 'cubic-bezier(.2,.8,.2,1)' }
      );
      tapAnimation.finished.then(
        () => themeToggle.classList.remove('theme-flip'),
        () => themeToggle.classList.remove('theme-flip')
      );
    }
    applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  });

  themeToggle?.addEventListener('animationend', () => themeToggle.classList.remove('theme-flip'));

  const showToast = (message, duration = 1700) => {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), duration);
  };

  const copyEmail = async (email) => {
    try {
      await navigator.clipboard.writeText(email);
      showToast('Email copied to clipboard');
      return true;
    } catch {
      window.location.href = `mailto:${email}`;
      return false;
    }
  };

  document.querySelectorAll('.copy-email').forEach((button) => {
    button.addEventListener('click', async () => {
      const original = button.textContent;
      const copied = await copyEmail(button.dataset.email);
      if (!copied) return;
      button.textContent = 'Copied';
      setTimeout(() => { button.textContent = original; }, 1500);
    });
  });

  const progress = document.querySelector('.reading-progress span');
  const updateProgress = () => {
    if (!progress) return;
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const amount = scrollable > 0 ? window.scrollY / scrollable : 0;
    progress.style.transform = `scaleX(${Math.min(1, Math.max(0, amount))})`;
  };
  updateProgress();
  window.addEventListener('scroll', updateProgress, { passive: true });

  const reveals = document.querySelectorAll('.reveal');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    reveals.forEach((el) => el.classList.add('visible'));
  } else {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    reveals.forEach((el) => revealObserver.observe(el));
  }

  const navLinks = [...document.querySelectorAll('.mini-nav a')];
  const sections = [...document.querySelectorAll('[data-section]')];
  if ('IntersectionObserver' in window && navLinks.length) {
    const sectionObserver = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      const id = visible.target.id;
      navLinks.forEach((link) => link.classList.toggle('active', link.getAttribute('href') === `#${id}`));
    }, { rootMargin: '-22% 0px -60% 0px', threshold: [0, .2, .5] });
    sections.filter((section) => section.id).forEach((section) => sectionObserver.observe(section));
  }

  document.querySelectorAll('.interactive-surface').forEach((surface) => {
    surface.addEventListener('pointermove', (event) => {
      const rect = surface.getBoundingClientRect();
      surface.style.setProperty('--mx', `${event.clientX - rect.left}px`);
      surface.style.setProperty('--my', `${event.clientY - rect.top}px`);
    });
  });

  document.querySelectorAll('.project').forEach((project) => {
    const link = project.querySelector('.project-link');
    if (!link) return;
    project.addEventListener('click', (event) => {
      if (event.target.closest('a,button')) return;
      link.click();
    });
  });

  const backToTop = document.querySelector('.back-to-top');
  let lastScrollY = window.scrollY;
  let backToTopAttentionTimer;

  const wakeBackToTop = () => {
    if (!backToTop) return;
    backToTop.classList.add('attention');
    clearTimeout(backToTopAttentionTimer);
    backToTopAttentionTimer = setTimeout(() => backToTop.classList.remove('attention'), 2400);
  };

  const updateFloatingControls = () => {
    const currentY = window.scrollY;
    if (currentY < lastScrollY - 2 && currentY > 120) wakeBackToTop();

    // On mobile the theme control behaves like a seamless sticky object:
    // it starts at its in-page location, moves upward naturally with scrolling,
    // then simply stops at its floating resting position.
    if (themeToggle && window.matchMedia('(max-width: 700px)').matches) {
      const headerBottom = siteHeader
        ? siteHeader.offsetTop + siteHeader.offsetHeight
        : 62;
      const startTop = headerBottom + 8;
      const restingTop = 12;
      const viewportTop = Math.max(restingTop, startTop - currentY);
      themeToggle.style.setProperty('--theme-toggle-mobile-top', `${viewportTop}px`);
    } else {
      themeToggle?.style.removeProperty('--theme-toggle-mobile-top');
    }

    backToTop?.classList.toggle('back-to-top-visible', currentY > 180);
    lastScrollY = currentY;
  };

  updateFloatingControls();
  window.addEventListener('scroll', updateFloatingControls, { passive: true });
  window.addEventListener('resize', updateFloatingControls, { passive: true });
  window.visualViewport?.addEventListener('resize', updateFloatingControls, { passive: true });

  backToTop?.addEventListener('click', () => {
    backToTop.classList.remove('attention');
    backToTop.classList.add('back-to-top-clicked');
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    setTimeout(() => backToTop.classList.remove('back-to-top-clicked'), 520);
  });


  // Match the visible shortcut key icon to the visitor's operating system.
  const shortcutModifier = document.querySelector('[data-shortcut-modifier]');
  const platform = String(navigator.userAgentData?.platform || navigator.platform || navigator.userAgent || '').toLowerCase();
  const shortcutIcon = shortcutModifier?.querySelector('i');

  if (shortcutModifier && shortcutIcon) {
    const isApple = platform.includes('mac') || platform.includes('iphone') || platform.includes('ipad');
    const isWindows = platform.includes('win');

    shortcutIcon.className = isApple
      ? 'bi bi-command'
      : isWindows
        ? 'bi bi-windows'
        : 'bi bi-terminal';

    shortcutModifier.setAttribute('aria-label', isApple ? 'Command' : isWindows ? 'Windows key' : 'Control');
  }

  // Project image viewer — zoomable/pannable gallery canvas.
  const projectLightbox = document.querySelector('.project-lightbox');
  const projectViewerStage = document.querySelector('.project-viewer-stage');
  const projectViewerCanvas = document.querySelector('.project-viewer-canvas');
  const projectLightboxImage = document.querySelector('.project-lightbox-image');
  const projectLightboxTitle = document.querySelector('.project-lightbox-title');
  const projectLightboxSize = document.querySelector('.project-lightbox-size');
  const projectZoomReadout = document.querySelector('.project-viewer-zoom-readout');

  const viewerState = {
    scale: 1,
    minScale: 0.2,
    maxScale: 6,
    x: 0,
    y: 0,
    fitScale: 1,
    pointers: new Map(),
    dragStart: null,
    pinchStart: null,
    fitAnimation: null
  };

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const renderProjectViewer = () => {
    if (!projectViewerCanvas) return;
    projectViewerCanvas.style.transform = `translate(-50%, -50%) translate3d(${viewerState.x}px, ${viewerState.y}px, 0) scale(${viewerState.scale})`;
    if (projectZoomReadout) projectZoomReadout.textContent = `${Math.round((viewerState.scale / viewerState.fitScale) * 100)}%`;
    projectViewerStage?.classList.toggle('is-zoomed', viewerState.scale > viewerState.fitScale * 1.02);
  };

  const fitProjectImage = ({ animate = true } = {}) => {
    if (!projectViewerStage || !projectLightboxImage?.naturalWidth) return;

    const rect = projectViewerStage.getBoundingClientRect();
    const padding = window.innerWidth <= 700 ? 28 : 70;
    const usableW = Math.max(80, rect.width - padding);
    const usableH = Math.max(80, rect.height - padding);
    const fit = Math.min(
      usableW / projectLightboxImage.naturalWidth,
      usableH / projectLightboxImage.naturalHeight,
      1
    );

    const targetScale = fit || 1;
    viewerState.fitScale = targetScale;
    viewerState.minScale = Math.min(targetScale * 0.55, targetScale);

    if (viewerState.fitAnimation) {
      cancelAnimationFrame(viewerState.fitAnimation);
      viewerState.fitAnimation = null;
    }

    if (!animate || reduceMotion) {
      viewerState.scale = targetScale;
      viewerState.x = 0;
      viewerState.y = 0;
      renderProjectViewer();
      return;
    }

    const from = {
      scale: viewerState.scale,
      x: viewerState.x,
      y: viewerState.y
    };
    const duration = 420;
    const startTime = performance.now();
    const ease = (t) => 1 - Math.pow(1 - t, 4);

    const step = (now) => {
      const t = Math.min(1, (now - startTime) / duration);
      const e = ease(t);

      viewerState.scale = from.scale + (targetScale - from.scale) * e;
      viewerState.x = from.x * (1 - e);
      viewerState.y = from.y * (1 - e);
      renderProjectViewer();

      if (t < 1) {
        viewerState.fitAnimation = requestAnimationFrame(step);
      } else {
        viewerState.fitAnimation = null;
        viewerState.scale = targetScale;
        viewerState.x = 0;
        viewerState.y = 0;
        renderProjectViewer();
      }
    };

    viewerState.fitAnimation = requestAnimationFrame(step);
  };

  const closeProjectLightbox = () => {
    if (projectLightbox?.open) projectLightbox.close();
    viewerState.pointers.clear();
    viewerState.dragStart = null;
    viewerState.pinchStart = null;
  };

  document.querySelectorAll('.project-preview').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const source = button.dataset.projectImage;
      const title = button.dataset.projectTitle || 'Project';
      if (!source || !projectLightbox || !projectLightboxImage) return;

      projectLightboxImage.src = source;
      projectLightboxImage.alt = `${title} interface preview`;
      if (projectLightboxTitle) projectLightboxTitle.textContent = title;
      if (projectLightboxSize) projectLightboxSize.textContent = '';
      projectLightbox.showModal();
    });
  });

  projectLightboxImage?.addEventListener('load', () => {
    if (projectLightboxSize && projectLightboxImage.naturalWidth) {
      projectLightboxSize.textContent = `${projectLightboxImage.naturalWidth} × ${projectLightboxImage.naturalHeight}`;
    }
    requestAnimationFrame(() => fitProjectImage({ animate: false }));
  });

  const zoomProjectViewer = (factor, clientX, clientY) => {
    if (!projectViewerStage) return;
    const rect = projectViewerStage.getBoundingClientRect();
    const px = clientX ?? rect.left + rect.width / 2;
    const py = clientY ?? rect.top + rect.height / 2;
    const localX = px - rect.left - rect.width / 2;
    const localY = py - rect.top - rect.height / 2;

    const previous = viewerState.scale;
    const next = clamp(previous * factor, viewerState.minScale, viewerState.maxScale);
    if (Math.abs(next - previous) < 0.0001) return;

    const ratio = next / previous;
    viewerState.x = localX - (localX - viewerState.x) * ratio;
    viewerState.y = localY - (localY - viewerState.y) * ratio;
    viewerState.scale = next;
    renderProjectViewer();
  };

  projectViewerStage?.addEventListener('wheel', (event) => {
    event.preventDefault();
    const factor = Math.exp(-event.deltaY * 0.0014);
    zoomProjectViewer(factor, event.clientX, event.clientY);
  }, { passive: false });

  projectViewerStage?.addEventListener('pointerdown', (event) => {
    if (event.target.closest('button')) return;
    projectViewerStage.setPointerCapture?.(event.pointerId);
    viewerState.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (viewerState.pointers.size === 1) {
      viewerState.dragStart = {
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        x: viewerState.x,
        y: viewerState.y
      };
      projectViewerStage.classList.add('is-dragging');
    } else if (viewerState.pointers.size === 2) {
      const [a, b] = [...viewerState.pointers.values()];
      viewerState.pinchStart = {
        distance: Math.hypot(b.x - a.x, b.y - a.y),
        scale: viewerState.scale,
        centerX: (a.x + b.x) / 2,
        centerY: (a.y + b.y) / 2
      };
      viewerState.dragStart = null;
    }
  });

  projectViewerStage?.addEventListener('pointermove', (event) => {
    if (!viewerState.pointers.has(event.pointerId)) return;
    viewerState.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (viewerState.pointers.size === 2 && viewerState.pinchStart) {
      const [a, b] = [...viewerState.pointers.values()];
      const distance = Math.hypot(b.x - a.x, b.y - a.y);
      const factor = distance / Math.max(1, viewerState.pinchStart.distance);
      const target = clamp(viewerState.pinchStart.scale * factor, viewerState.minScale, viewerState.maxScale);
      const currentFactor = target / viewerState.scale;
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      zoomProjectViewer(currentFactor, cx, cy);
      return;
    }

    if (viewerState.dragStart?.pointerId === event.pointerId) {
      viewerState.x = viewerState.dragStart.x + (event.clientX - viewerState.dragStart.clientX);
      viewerState.y = viewerState.dragStart.y + (event.clientY - viewerState.dragStart.clientY);
      renderProjectViewer();
    }
  });

  const endViewerPointer = (event) => {
    viewerState.pointers.delete(event.pointerId);
    if (viewerState.pointers.size < 2) viewerState.pinchStart = null;
    if (viewerState.dragStart?.pointerId === event.pointerId) viewerState.dragStart = null;
    if (!viewerState.pointers.size) projectViewerStage?.classList.remove('is-dragging');
  };
  projectViewerStage?.addEventListener('pointerup', endViewerPointer);
  projectViewerStage?.addEventListener('pointercancel', endViewerPointer);

  document.querySelector('.project-viewer-zoom-in')?.addEventListener('click', () => zoomProjectViewer(1.22));
  document.querySelector('.project-viewer-zoom-out')?.addEventListener('click', () => zoomProjectViewer(1 / 1.22));
  document.querySelector('.project-viewer-reset')?.addEventListener('click', fitProjectImage);
  document.querySelector('.project-lightbox-close')?.addEventListener('click', closeProjectLightbox);

  projectViewerStage?.addEventListener('dblclick', (event) => {
    if (event.target.closest('button')) return;
    if (viewerState.scale > viewerState.fitScale * 1.15) {
      fitProjectImage();
    } else {
      zoomProjectViewer(2, event.clientX, event.clientY);
    }
  });

  window.addEventListener('resize', () => {
    if (projectLightbox?.open) fitProjectImage({ animate: false });
  }, { passive: true });

  let projectLightboxBackdropPointer = null;
  const pointIsOutsideLightbox = (event) => {
    if (!projectLightbox) return false;
    const rect = projectLightbox.getBoundingClientRect();
    return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
  };

  projectLightbox?.addEventListener('pointerdown', (event) => {
    if (!pointIsOutsideLightbox(event)) {
      projectLightboxBackdropPointer = null;
      return;
    }
    projectLightboxBackdropPointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
  });

  projectLightbox?.addEventListener('pointerup', (event) => {
    if (!projectLightboxBackdropPointer || projectLightboxBackdropPointer.id !== event.pointerId) return;
    const distance = Math.hypot(event.clientX - projectLightboxBackdropPointer.x, event.clientY - projectLightboxBackdropPointer.y);
    const shouldClose = pointIsOutsideLightbox(event) && distance < 6;
    projectLightboxBackdropPointer = null;
    if (shouldClose) closeProjectLightbox();
  });

  projectLightbox?.addEventListener('pointercancel', () => { projectLightboxBackdropPointer = null; });

  // Resume viewer: render a browser-independent page image in the portfolio
  // while preserving direct PDF open and download actions in the viewer chrome.
  const resumeViewer = document.querySelector('.resume-viewer');

  const openResumeViewer = () => {
    if (!resumeViewer) return;
    if (!resumeViewer.open) resumeViewer.showModal();
  };

  const closeResumeViewer = () => {
    if (resumeViewer?.open) resumeViewer.close();
  };

  document.querySelector('[data-resume-open]')?.addEventListener('click', openResumeViewer);
  document.querySelector('.resume-viewer-close')?.addEventListener('click', closeResumeViewer);

  let resumeBackdropPointer = null;
  resumeViewer?.addEventListener('pointerdown', (event) => {
    resumeBackdropPointer = event.target === resumeViewer
      ? { id: event.pointerId, x: event.clientX, y: event.clientY }
      : null;
  });
  resumeViewer?.addEventListener('pointerup', (event) => {
    if (!resumeBackdropPointer || resumeBackdropPointer.id !== event.pointerId) return;
    const distance = Math.hypot(event.clientX - resumeBackdropPointer.x, event.clientY - resumeBackdropPointer.y);
    const shouldClose = event.target === resumeViewer && distance < 6;
    resumeBackdropPointer = null;
    if (shouldClose) closeResumeViewer();
  });
  resumeViewer?.addEventListener('pointercancel', () => { resumeBackdropPointer = null; });

  // Website showcase. A static site cannot enumerate server folders, so /websites/sites.json
  // is the lightweight index that points each card at a folder under /websites/.
  const websiteTrack = document.querySelector('.website-carousel-track');
  const websiteInner = document.querySelector('.website-carousel-inner');
  const websiteEmpty = document.querySelector('.websites-empty');
  const carouselControls = document.querySelector('.carousel-controls');
  const carouselPrev = document.querySelector('.carousel-prev');
  const carouselNext = document.querySelector('.carousel-next');
  const carouselStatus = document.querySelector('.website-carousel-status');
  const carouselProgress = carouselStatus?.querySelector('span');
  const browserDialog = document.querySelector('.site-browser');
  const browserFrame = document.querySelector('.browser-frame');
  const browserAddress = document.querySelector('.browser-address-text');
  const browserTitle = document.querySelector('.browser-site-title');
  const browserDock = document.querySelector('.browser-dock');
  const browserDockTitle = document.querySelector('.browser-dock-title');
  const browserError = document.querySelector('.browser-error');
  const browserBack = document.querySelector('.browser-back');
  const browserForward = document.querySelector('.browser-forward');
  const browserReload = document.querySelector('.browser-reload');
  const browserMaximize = document.querySelector('.browser-maximize');
  let activeWebsite = null;
  let previewHistory = [];
  let previewHistoryIndex = -1;
  let historyNavigation = false;
  let frameNavigationCleanup = null;

  const portfolioBaseUrl = new URL('./', document.baseURI);

  const normalizeWebsitePath = (path) => {
    const clean = String(path || '').trim();
    if (!clean) return '';
    if (/^https?:\/\//i.test(clean)) return new URL(clean).href;
    if (clean.startsWith('/')) return new URL(clean.replace(/^\/+/, ''), portfolioBaseUrl).href;
    const folder = clean.replace(/^\/+|\/+$/g, '');
    return new URL(`websites/${folder}/`, portfolioBaseUrl).href;
  };

  const displayAddress = (url) => {
    try {
      const parsed = new URL(url, window.location.origin);
      return parsed.host === window.location.host
        ? `${parsed.host}${parsed.pathname}${parsed.search}${parsed.hash}`
        : parsed.href;
    } catch {
      return url;
    }
  };

  const setBrowserAddress = (url) => {
    if (browserAddress) browserAddress.textContent = displayAddress(url);
  };

  const updateBrowserNavigation = () => {
    if (browserBack) browserBack.disabled = previewHistoryIndex <= 0;
    if (browserForward) browserForward.disabled = previewHistoryIndex < 0 || previewHistoryIndex >= previewHistory.length - 1;
    if (browserReload) browserReload.disabled = previewHistoryIndex < 0;
  };

  const setBrowserMaximized = (maximized) => {
    if (!browserDialog) return;
    browserDialog.classList.toggle('maximized', Boolean(maximized));
    if (browserMaximize) {
      browserMaximize.setAttribute('aria-pressed', String(Boolean(maximized)));
      browserMaximize.setAttribute('aria-label', maximized ? 'Restore website size' : 'Maximize website');
      browserMaximize.title = maximized ? 'Restore' : 'Maximize';
      browserMaximize.textContent = maximized ? '❐' : '□';
    }
  };

  const recordPreviewLocation = (url) => {
    if (!url || url === 'about:blank') return;
    const current = previewHistory[previewHistoryIndex];
    if (current === url) return;
    previewHistory = previewHistory.slice(0, previewHistoryIndex + 1);
    previewHistory.push(url);
    previewHistoryIndex = previewHistory.length - 1;
    updateBrowserNavigation();
  };

  const navigatePreview = (url, { fromHistory = false } = {}) => {
    if (!browserFrame || !url) return;
    browserDialog?.classList.add('loading');
    if (browserError) browserError.hidden = true;
    if (!fromHistory) recordPreviewLocation(url);
    historyNavigation = fromHistory;
    setBrowserAddress(url);
    browserFrame.src = url;
  };

  const updateCarouselControls = () => {
    if (!websiteTrack) return;
    const max = Math.max(0, websiteTrack.scrollWidth - websiteTrack.clientWidth);
    const x = websiteTrack.scrollLeft;
    const canScroll = max > 8;

    // Only show carousel UI when there is actually something off-screen.
    // This responds to viewport changes, so controls can appear later if the
    // same set of cards no longer fits.
    if (carouselControls) carouselControls.hidden = !canScroll;
    if (carouselStatus) carouselStatus.hidden = !canScroll;

    if (carouselPrev) carouselPrev.disabled = !canScroll || x < 8;
    if (carouselNext) carouselNext.disabled = !canScroll || x > max - 8;
    if (carouselProgress) {
      carouselProgress.style.transform = `scaleX(${canScroll ? Math.min(1, Math.max(.08, x / max)) : 1})`;
    }
  };

  const closeBrowser = ({ unload = true } = {}) => {
    if (!browserDialog) return;
    setBrowserMaximized(false);
    browserDialog.classList.remove('loading');
    if (browserDialog.open) browserDialog.close();
    if (browserDock) browserDock.hidden = true;
    if (unload && browserFrame) browserFrame.src = 'about:blank';
    if (unload) {
      activeWebsite = null;
      previewHistory = [];
      previewHistoryIndex = -1;
      historyNavigation = false;
      frameNavigationCleanup?.();
      frameNavigationCleanup = null;
      updateBrowserNavigation();
    }
  };

  const openBrowser = (site) => {
    if (!browserDialog || !browserFrame) return;
    activeWebsite = site;
    const url = normalizeWebsitePath(site.path || site.folder || site.url);
    if (!url) return;
    previewHistory = [url];
    previewHistoryIndex = 0;
    updateBrowserNavigation();
    setBrowserMaximized(false);
    browserTitle.textContent = site.title || site.name || 'Website';
    if (browserDockTitle) browserDockTitle.textContent = site.title || site.name || 'Website';
    navigatePreview(url, { fromHistory: true });
    if (!browserDialog.open) browserDialog.showModal();
  };

  const makeWebsiteCard = (site) => {
    const url = normalizeWebsitePath(site.path || site.folder || site.url);
    if (!url) return null;
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'website-card';
    card.setAttribute('aria-label', `Open ${site.title || site.name || 'website'} preview`);

    const preview = document.createElement('div');
    preview.className = 'website-card-preview';
    const frame = document.createElement('iframe');
    frame.title = '';
    frame.tabIndex = -1;
    frame.loading = 'lazy';
    frame.setAttribute('aria-hidden', 'true');
    frame.src = url;
    const sheen = document.createElement('span');
    sheen.className = 'website-card-sheen';
    preview.append(frame, sheen);

    const meta = document.createElement('div');
    meta.className = 'website-card-meta';
    const kicker = document.createElement('span');
    kicker.className = 'website-card-kicker';
    kicker.textContent = site.role || 'Website';
    const title = document.createElement('h3');
    title.className = 'website-card-title';
    title.append(document.createTextNode(site.title || site.name || 'Untitled site'));
    const arrow = document.createElement('span');
    arrow.textContent = '↗';
    arrow.setAttribute('aria-hidden', 'true');
    title.append(arrow);
    meta.append(kicker, title);
    if (site.description) {
      const description = document.createElement('p');
      description.className = 'website-card-description';
      description.textContent = site.description;
      meta.append(description);
    }
    card.append(preview, meta);
    card.addEventListener('click', () => openBrowser(site));
    return card;
  };

  const loadWebsiteShowcase = async () => {
    if (!websiteInner) return;
    try {
      const response = await fetch(new URL('websites/sites.json', portfolioBaseUrl), { cache: 'no-store' });
      if (!response.ok) throw new Error(`Manifest returned ${response.status}`);
      const data = await response.json();
      const sites = Array.isArray(data) ? data : Array.isArray(data.sites) ? data.sites : [];
      websiteInner.innerHTML = '';
      sites.forEach((site) => {
        const card = makeWebsiteCard(site);
        if (card) websiteInner.append(card);
      });
      const hasSites = websiteInner.children.length > 0;
      if (websiteEmpty) websiteEmpty.hidden = hasSites;
      document.querySelector('.website-carousel')?.toggleAttribute('hidden', !hasSites);
      requestAnimationFrame(updateCarouselControls);
    } catch (error) {
      console.warn('Website showcase manifest could not be loaded:', error);
      if (websiteEmpty) websiteEmpty.hidden = false;
      document.querySelector('.website-carousel')?.setAttribute('hidden', '');
    }
  };

  carouselPrev?.addEventListener('click', () => websiteTrack?.scrollBy({ left: -270, behavior: reduceMotion ? 'auto' : 'smooth' }));
  carouselNext?.addEventListener('click', () => websiteTrack?.scrollBy({ left: 270, behavior: reduceMotion ? 'auto' : 'smooth' }));
  websiteTrack?.addEventListener('scroll', updateCarouselControls, { passive: true });
  window.addEventListener('resize', updateCarouselControls, { passive: true });

  // Shift+wheel gives the carousel a natural horizontal scrub without hijacking normal scrolling.
  websiteTrack?.addEventListener('wheel', (event) => {
    if (!event.shiftKey || Math.abs(event.deltaY) < Math.abs(event.deltaX)) return;
    event.preventDefault();
    websiteTrack.scrollLeft += event.deltaY;
  }, { passive: false });

  websiteTrack?.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    websiteTrack.scrollBy({ left: event.key === 'ArrowLeft' ? -270 : 270, behavior: reduceMotion ? 'auto' : 'smooth' });
  });

  let carouselDrag = null;
  let suppressCarouselClick = false;
  websiteTrack?.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    carouselDrag = { id: event.pointerId, x: event.clientX, scroll: websiteTrack.scrollLeft };
    suppressCarouselClick = false;
  });
  websiteTrack?.addEventListener('pointermove', (event) => {
    if (!carouselDrag || carouselDrag.id !== event.pointerId) return;
    const dx = event.clientX - carouselDrag.x;
    if (Math.abs(dx) > 6) {
      suppressCarouselClick = true;
      websiteTrack.setPointerCapture?.(event.pointerId);
      websiteTrack.scrollLeft = carouselDrag.scroll - dx;
    }
  });
  const finishCarouselDrag = () => { carouselDrag = null; requestAnimationFrame(() => { suppressCarouselClick = false; }); };
  websiteTrack?.addEventListener('pointerup', finishCarouselDrag);
  websiteTrack?.addEventListener('pointercancel', finishCarouselDrag);
  websiteTrack?.addEventListener('click', (event) => {
    if (!suppressCarouselClick) return;
    event.preventDefault();
    event.stopPropagation();
  }, true);

  document.querySelector('.browser-close')?.addEventListener('click', () => closeBrowser());
  document.querySelector('.browser-minimize')?.addEventListener('click', () => {
    if (!browserDialog?.open) return;
    browserDialog.close();
    if (browserDock) browserDock.hidden = false;
  });
  browserMaximize?.addEventListener('click', () => setBrowserMaximized(!browserDialog?.classList.contains('maximized')));
  document.querySelector('.browser-chrome')?.addEventListener('dblclick', (event) => {
    if (event.target.closest('button, input')) return;
    setBrowserMaximized(!browserDialog?.classList.contains('maximized'));
  });
  browserReload?.addEventListener('click', () => {
    if (!browserFrame) return;
    browserDialog?.classList.add('loading');
    try { browserFrame.contentWindow.location.reload(); } catch { browserFrame.src = browserFrame.src; }
  });
  browserBack?.addEventListener('click', () => {
    if (previewHistoryIndex <= 0) return;
    previewHistoryIndex -= 1;
    updateBrowserNavigation();
    navigatePreview(previewHistory[previewHistoryIndex], { fromHistory: true });
  });
  browserForward?.addEventListener('click', () => {
    if (previewHistoryIndex >= previewHistory.length - 1) return;
    previewHistoryIndex += 1;
    updateBrowserNavigation();
    navigatePreview(previewHistory[previewHistoryIndex], { fromHistory: true });
  });
  const restoreBrowser = ({ maximize = false } = {}) => {
    if (!browserDialog || !browserDock) return;
    browserDock.hidden = true;
    if (!browserDialog.open) browserDialog.showModal();
    setBrowserMaximized(maximize);
  };

  document.querySelector('.browser-dock-restore')?.addEventListener('click', () => restoreBrowser());
  document.querySelector('.browser-dock-minimize')?.addEventListener('click', (event) => {
    event.stopPropagation();
    restoreBrowser();
  });
  document.querySelector('.browser-dock-maximize')?.addEventListener('click', (event) => {
    event.stopPropagation();
    restoreBrowser({ maximize: true });
  });
  document.querySelector('.browser-dock-close')?.addEventListener('click', (event) => {
    event.stopPropagation();
    closeBrowser();
  });
  browserDialog?.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeBrowser();
  });
  browserFrame?.addEventListener('load', () => {
    browserDialog?.classList.remove('loading');
    if (browserError) browserError.hidden = true;
    frameNavigationCleanup?.();
    frameNavigationCleanup = null;
    const wasHistoryNavigation = historyNavigation;
    historyNavigation = false;
    try {
      const current = browserFrame.contentWindow.location.href;
      if (current && current !== 'about:blank') {
        setBrowserAddress(current);
        if (!wasHistoryNavigation) recordPreviewLocation(current);
      }
      const title = browserFrame.contentDocument?.title;
      if (title && browserTitle) {
        browserTitle.textContent = title;
        if (browserDockTitle) browserDockTitle.textContent = title;
      }
      const syncInPageNavigation = () => {
        try {
          const url = browserFrame.contentWindow.location.href;
          setBrowserAddress(url);
          recordPreviewLocation(url);
        } catch {}
      };
      browserFrame.contentWindow.addEventListener('hashchange', syncInPageNavigation);
      browserFrame.contentWindow.addEventListener('popstate', syncInPageNavigation);
      frameNavigationCleanup = () => {
        try {
          browserFrame.contentWindow.removeEventListener('hashchange', syncInPageNavigation);
          browserFrame.contentWindow.removeEventListener('popstate', syncInPageNavigation);
        } catch {}
      };
    } catch {}
    updateBrowserNavigation();
  });
  browserFrame?.addEventListener('error', () => {
    browserDialog?.classList.remove('loading');
    if (browserError) browserError.hidden = false;
  });
  browserDialog?.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeBrowser();
  });

  // Close the fake browser only on a genuine backdrop click. A drag that
  // starts in the browser and ends outside is ignored, matching the composer.
  let browserBackdropPointer = null;
  const pointIsOutsideBrowser = (event) => {
    if (!browserDialog) return false;
    const rect = browserDialog.getBoundingClientRect();
    return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
  };

  browserDialog?.addEventListener('pointerdown', (event) => {
    if (!pointIsOutsideBrowser(event)) {
      browserBackdropPointer = null;
      return;
    }
    browserBackdropPointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
  });

  browserDialog?.addEventListener('pointerup', (event) => {
    if (!browserBackdropPointer || browserBackdropPointer.id !== event.pointerId) return;
    const distance = Math.hypot(event.clientX - browserBackdropPointer.x, event.clientY - browserBackdropPointer.y);
    const shouldClose = pointIsOutsideBrowser(event) && distance < 6;
    browserBackdropPointer = null;
    if (shouldClose) closeBrowser();
  });

  browserDialog?.addEventListener('pointercancel', () => { browserBackdropPointer = null; });

  loadWebsiteShowcase();

  // Ctrl/Cmd+K email composer.
  const dialog = document.querySelector('.email-composer');
  const subject = document.querySelector('.composer-subject');
  const senderEmail = document.querySelector('.composer-email');
  const editor = document.querySelector('.composer-body');
  const attachmentInput = document.querySelector('.attachment-input');
  const attachmentArea = document.querySelector('.composer-attachments');
  const attachmentList = document.querySelector('.attachment-list');
  const sendButton = document.querySelector('.composer-send');
  const CONTACT_ENDPOINT = 'https://mollemira-contact-104333027872.us-central1.run.app';
  const MAX_ATTACHMENTS = 5;
  const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
  const MAX_TOTAL_ATTACHMENT_BYTES = 20 * 1024 * 1024;
  let attachments = [];

  const openComposer = () => {
    if (!dialog || dialog.open) return;
    dialog.showModal();
    requestAnimationFrame(() => subject?.focus());
  };

  const closeComposer = () => dialog?.close();

  document.querySelectorAll('[data-command-open]').forEach((button) => button.addEventListener('click', openComposer));
  document.querySelector('.composer-close')?.addEventListener('click', closeComposer);

  document.addEventListener('keydown', (event) => {
    const modifier = event.metaKey || event.ctrlKey;
    if (modifier && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      openComposer();
    }
  });

  // Close only for a real click/tap that both starts and ends on the backdrop.
  // A text-selection drag that begins inside the composer and ends outside no longer closes it.
  let backdropPointer = null;
  const pointIsOutsideDialog = (event) => {
    if (!dialog) return false;
    const rect = dialog.getBoundingClientRect();
    return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
  };

  dialog?.addEventListener('pointerdown', (event) => {
    if (!pointIsOutsideDialog(event)) {
      backdropPointer = null;
      return;
    }
    backdropPointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
  });

  dialog?.addEventListener('pointerup', (event) => {
    if (!backdropPointer || backdropPointer.id !== event.pointerId) return;
    const distance = Math.hypot(event.clientX - backdropPointer.x, event.clientY - backdropPointer.y);
    const shouldClose = pointIsOutsideDialog(event) && distance < 6;
    backdropPointer = null;
    if (shouldClose) dialog.close();
  });

  dialog?.addEventListener('pointercancel', () => { backdropPointer = null; });

  document.querySelectorAll('[data-format]').forEach((button) => {
    button.addEventListener('mousedown', (event) => event.preventDefault());
    button.addEventListener('click', () => {
      editor?.focus();
      document.execCommand(button.dataset.format, false, null);
    });
  });

  const linkButton = document.querySelector('[data-add-link]');
  const linkPanel = document.querySelector('.composer-link-panel');
  const linkInput = document.querySelector('.composer-link-input');
  const linkApply = document.querySelector('.composer-link-apply');
  const linkDismiss = document.querySelector('.composer-link-dismiss');
  let savedEditorRange = null;

  const rememberEditorSelection = () => {
    if (!editor) return;
    const selection = window.getSelection();
    if (!selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer)) savedEditorRange = range.cloneRange();
  };

  document.addEventListener('selectionchange', rememberEditorSelection);

  const closeLinkPanel = ({ restoreFocus = true } = {}) => {
    linkPanel?.classList.remove('open');
    linkPanel?.setAttribute('aria-hidden', 'true');
    if (restoreFocus) editor?.focus();
  };

  const openLinkPanel = () => {
    rememberEditorSelection();
    linkPanel?.classList.add('open');
    linkPanel?.setAttribute('aria-hidden', 'false');
    if (linkInput) {
      linkInput.value = '';
      requestAnimationFrame(() => linkInput.focus());
    }
  };

  const restoreEditorSelection = () => {
    if (!editor || !savedEditorRange) return false;
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(savedEditorRange);
    editor.focus();
    return true;
  };

  const normalizeLink = (value) => {
    const clean = String(value || '').trim();
    if (!clean) return '';
    if (/^(https?:|mailto:|tel:)/i.test(clean)) return clean;
    return `https://${clean}`;
  };

  const applyComposerLink = () => {
    const url = normalizeLink(linkInput?.value);
    if (!url) {
      linkInput?.focus();
      return;
    }

    const restored = restoreEditorSelection();
    const selection = window.getSelection();

    if (restored && selection && !selection.isCollapsed) {
      document.execCommand('createLink', false, url);
    } else if (editor) {
      editor.focus();
      const safeText = url.replace(/[&<>"']/g, (char) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      }[char]));
      document.execCommand('insertHTML', false, `<a href="${safeText}">${safeText}</a>`);
    }

    closeLinkPanel();
    savedEditorRange = null;
  };

  linkButton?.addEventListener('pointerdown', (event) => {
    // Save the editor selection before tapping/clicking the toolbar can move focus.
    rememberEditorSelection();

    // Mouse users should not lose the selection to the toolbar button itself.
    if (event.pointerType === 'mouse') event.preventDefault();
  });
  linkButton?.addEventListener('click', openLinkPanel);
  linkApply?.addEventListener('click', applyComposerLink);
  linkDismiss?.addEventListener('click', () => closeLinkPanel());
  linkInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      applyComposerLink();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeLinkPanel();
    }
  });

  const formatBytes = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const renderAttachments = () => {
    if (!attachmentList || !attachmentArea) return;
    attachmentList.innerHTML = '';
    attachmentArea.hidden = attachments.length === 0;
    attachments.forEach((file, index) => {
      const chip = document.createElement('div');
      chip.className = 'attachment-chip';
      const name = document.createElement('span');
      name.textContent = `${file.name} · ${formatBytes(file.size)}`;
      name.title = file.name;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.setAttribute('aria-label', `Remove ${file.name}`);
      remove.textContent = '×';
      remove.addEventListener('click', () => {
        attachments.splice(index, 1);
        renderAttachments();
      });
      chip.append(name, remove);
      attachmentList.append(chip);
    });
  };

  const addAttachments = (files) => {
    const selected = Array.from(files || []).filter((file) => file instanceof File);
    if (!selected.length) return;

    if (attachments.length + selected.length > MAX_ATTACHMENTS) {
      showToast(`You can attach up to ${MAX_ATTACHMENTS} files`);
      return;
    }

    const oversized = selected.find((file) => file.size > MAX_ATTACHMENT_BYTES);
    if (oversized) {
      showToast(`${oversized.name} is over the 8 MB file limit`, 2600);
      return;
    }

    const newTotal = [...attachments, ...selected].reduce((sum, file) => sum + file.size, 0);
    if (newTotal > MAX_TOTAL_ATTACHMENT_BYTES) {
      showToast('Attachments must stay under 20 MB total', 2600);
      return;
    }

    attachments = [...attachments, ...selected];
    renderAttachments();
  };

  attachmentInput?.addEventListener('change', () => {
    addAttachments(attachmentInput.files);
    attachmentInput.value = '';
  });

  // Silent drag-and-drop support: dragging files anywhere over the composer attaches them.
  // There is intentionally no persistent instructional UI for this.
  ['dragenter', 'dragover'].forEach((type) => {
    dialog?.addEventListener(type, (event) => {
      if (!event.dataTransfer?.types?.includes('Files')) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
      dialog.classList.add('file-drag-active');
    });
  });

  dialog?.addEventListener('dragleave', (event) => {
    if (event.relatedTarget && dialog.contains(event.relatedTarget)) return;
    dialog.classList.remove('file-drag-active');
  });

  dialog?.addEventListener('drop', (event) => {
    if (!event.dataTransfer?.files?.length) return;
    event.preventDefault();
    dialog.classList.remove('file-drag-active');
    addAttachments(event.dataTransfer.files);
  });

  const clearComposer = () => {
    if (subject) subject.value = '';
    if (senderEmail) senderEmail.value = '';
    if (editor) editor.innerHTML = '';
    attachments = [];
    renderAttachments();
    subject?.focus();
  };
  document.querySelector('.clear-composer')?.addEventListener('click', clearComposer);

  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const plainTextFromEditor = () => editor?.innerText.trim() || '';
  const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  sendButton?.addEventListener('click', async () => {
    const email = senderEmail?.value.trim() || '';
    const subj = subject?.value.trim() || '';
    const html = editor?.innerHTML.trim() || '';
    const plain = plainTextFromEditor();

    if (!validEmail(email)) {
      showToast('Enter an email address so I can reply');
      senderEmail?.focus();
      return;
    }

    if (!subj) {
      showToast('Add a subject first');
      subject?.focus();
      return;
    }

    if (!plain) {
      showToast('Write a message first');
      editor?.focus();
      return;
    }

    const originalLabel = sendButton.innerHTML;
    sendButton.disabled = true;
    sendButton.classList.add('sending');
    sendButton.textContent = 'Sending…';

    try {
      const encodedAttachments = await Promise.all(attachments.map(async (file) => ({
        name: file.name,
        type: file.type || 'application/octet-stream',
        data: await fileToBase64(file)
      })));

      const response = await fetch(CONTACT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          subject: subj,
          html,
          text: plain,
          attachments: encodedAttachments,
          website: ''
        })
      });

      let result = {};
      try { result = await response.json(); } catch {}

      if (!response.ok || !result.ok) {
        throw new Error(result.error || `Request failed (${response.status})`);
      }

      clearComposer();
      dialog?.close();
      showToast('Message sent — I’ll be able to reply by email', 3000);
    } catch (error) {
      console.error('Contact send failed:', error);
      showToast('Could not send the message. Please try again.', 3000);
    } finally {
      sendButton.disabled = false;
      sendButton.classList.remove('sending');
      sendButton.innerHTML = originalLabel;
    }
  });
})();
