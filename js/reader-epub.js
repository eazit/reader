/**
 * Eazit Reader - EPUB Format Rendering Engine (ePub.js Integration)
 */

import { State } from './config.js';
import { scheduleDriveSync } from './auth.js';
import { updateProgressUI, showToast, hideLoading, renderToc, toggleToolbar, setToolbarVisibility, getFontFamilyCss } from './ui.js';
import { prevPage, nextPage, handleTouchStart, handleTouchEnd } from './main.js';

let lastEpubTouchEndTime = 0;

export async function loadEpubBook(arrayBuffer, savedDescription) {
  State.fileType = 'epub';
  const container = document.getElementById('epub-render-area');
  const txtContainer = document.getElementById('txt-render-area');
  if (container) {
    container.style.display = 'block';
    container.innerHTML = '';
  }
  if (txtContainer) txtContainer.style.display = 'none';

  const flowMode = State.settings.readMode === 'scroll' ? 'scrolled-doc' : 'paginated';
  
  // @ts-ignore
  State.book = ePub(arrayBuffer);
  State.rendition = State.book.renderTo(container, {
    width: '100%',
    height: '100%',
    spread: 'none',
    flow: flowMode,
  });

  applyEpubStyles();

  // Attach hooks to every rendered section/iframe
  State.rendition.hooks.content.register(attachEpubContentListeners);

  let startCfi = null;
  if (savedDescription) {
    try {
      const meta = JSON.parse(savedDescription);
      if (meta.type === 'epub' && meta.cfi) startCfi = meta.cfi;
    } catch (e) {}
  }

  try {
    if (startCfi) {
      try {
        await State.rendition.display(startCfi);
      } catch (cfiErr) {
        console.warn('[EPUB] CFI display failed, falling back to beginning', cfiErr);
        await State.rendition.display();
      }
    } else {
      await State.rendition.display();
    }
  } catch (renderErr) {
    console.error('[EPUB] Render error:', renderErr);
    showToast('EPUB 렌더링 중 오류가 발생했습니다.');
  } finally {
    hideLoading();
  }

  State.book.loaded.navigation.then(nav => {
    State.toc = nav.toc || [];
    renderToc(State.toc);
  }).catch(() => {});

  State.rendition.on('relocated', location => {
    if (!location || !location.start) return;
    const cfi = location.start.cfi;
    const pct = location.start.percentage ? location.start.percentage * 100 : 0;

    updateProgressUI(pct);

    scheduleDriveSync({
      type: 'epub',
      cfi: cfi,
      progress: pct / 100,
      updatedAt: Date.now()
    });
  });

  // Attach container scroll auto-hide
  if (container) {
    let lastEpubScroll = 0;
    container.addEventListener('scroll', () => {
      if (State.toolbarVisible && State.settings.readMode === 'scroll') {
        const cur = container.scrollTop;
        if (Math.abs(cur - lastEpubScroll) > 12) {
          setToolbarVisibility(false);
        }
        lastEpubScroll = cur;
      }
    }, { passive: true });
  }
}

export function attachEpubContentListeners(contents) {
  try {
    const doc = contents.document;
    if (!doc) return;

    let isScrolling = false;
    let touchStartTime = 0;
    let touchStartPos = { x: 0, y: 0 };

    doc.addEventListener('touchstart', e => {
      isScrolling = false;
      touchStartTime = Date.now();
      if (e.touches && e.touches[0]) {
        touchStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
      handleTouchStart(e);
    }, { passive: true });

    doc.addEventListener('touchmove', e => {
      if (e.touches && e.touches[0]) {
        const moveDist = Math.hypot(e.touches[0].clientX - touchStartPos.x, e.touches[0].clientY - touchStartPos.y);
        if (moveDist > 10) {
          isScrolling = true;
        }
      }
    }, { passive: true });

    doc.addEventListener('touchend', e => {
      if (!isScrolling) {
        const elapsed = Date.now() - touchStartTime;
        const t = e.changedTouches && e.changedTouches[0] ? e.changedTouches[0] : null;
        let dist = 0;
        if (t) {
          dist = Math.hypot(t.clientX - touchStartPos.x, t.clientY - touchStartPos.y);
        }
        if (elapsed < 400 && dist < 20) {
          lastEpubTouchEndTime = Date.now();
          handleEpubTap(t ? t.clientX : window.innerWidth / 2);
        }
      }
      handleTouchEnd(e);
    }, { passive: true });

    doc.addEventListener('click', e => {
      if (Date.now() - lastEpubTouchEndTime < 450) return;
      const sel = doc.getSelection ? doc.getSelection() : window.getSelection();
      if (sel && sel.toString().trim().length > 0) return;
      handleEpubTap(e.clientX);
    });

    let lastDocScroll = 0;
    doc.addEventListener('scroll', () => {
      if (State.toolbarVisible && State.settings.readMode === 'scroll') {
        const cur = doc.documentElement.scrollTop || doc.body.scrollTop || 0;
        if (Math.abs(cur - lastDocScroll) > 12) {
          setToolbarVisibility(false);
        }
        lastDocScroll = cur;
      }
    }, { passive: true });
  } catch (e) {
    console.warn('[EPUB] Listener attachment error:', e);
  }
}

export function handleEpubTap(clientX) {
  const width = window.innerWidth;
  if (State.settings.readMode === 'page') {
    if (clientX < width * 0.25) {
      prevPage();
    } else if (clientX > width * 0.75) {
      nextPage();
    } else {
      toggleToolbar();
    }
  } else {
    toggleToolbar();
  }
}

export function applyEpubStyles() {
  if (!State.rendition) return;
  const theme = State.settings.theme;
  const fontSize = `${State.settings.fontSize}px`;
  const lineHeight = State.settings.lineHeight;

  let bg = '#ffffff';
  let color = '#1e293b';
  if (theme === 'sepia') { bg = '#f8f3e8'; color = '#3c2f1f'; }
  if (theme === 'dark') { bg = '#0b0f19'; color = '#e2e8f0'; }

  State.rendition.themes.register('custom', {
    body: {
      'background-color': `${bg} !important`,
      'color': `${color} !important`,
      'font-family': getFontFamilyCss(State.settings.fontFamily),
      'font-size': fontSize,
      'line-height': `${lineHeight} !important`,
      'padding': '1.5rem 1.25rem !important'
    },
    'p, span, div': {
      'color': `${color} !important`,
      'line-height': `${lineHeight} !important`,
    }
  });
  State.rendition.themes.select('custom');
}
