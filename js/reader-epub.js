/**
 * Eazit Reader - EPUB Format Rendering Engine (ePub.js Integration)
 */

import { State } from './config.js';
import { scheduleDriveSync } from './auth.js';
import { updateProgressUI, showToast, hideLoading, renderToc, toggleToolbar, getFontFamilyCss } from './ui.js';
import { prevPage, nextPage, handleTouchStart, handleTouchEnd } from './main.js';

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

  State.rendition.on('rendered', () => {
    try {
      const doc = State.rendition.getContents()[0]?.document;
      if (doc) {
        doc.addEventListener('click', handleEpubIframeClick);
        doc.addEventListener('touchstart', handleTouchStart, { passive: true });
        doc.addEventListener('touchend', handleTouchEnd, { passive: true });
      }
    } catch (e) {}
  });
}

export function handleEpubIframeClick(e) {
  const width = window.innerWidth;
  const clickX = e.clientX;
  if (State.settings.readMode === 'page') {
    if (clickX < width * 0.25) {
      prevPage();
    } else if (clickX > width * 0.75) {
      nextPage();
    } else {
      toggleToolbar();
    }
  } else {
    if (clickX >= width * 0.25 && clickX <= width * 0.75) {
      toggleToolbar();
    }
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
