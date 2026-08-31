/**
 * Eazit Reader - Plain Text (TXT) Novel Reader Engine
 */

import { State } from './config.js';
import { scheduleDriveSync } from './auth.js';
import { updateProgressUI, hideLoading, renderToc, getFontFamilyCss, toggleToolbar, setToolbarVisibility } from './ui.js';

export function loadTxtBook(textContent, savedDescription) {
  try {
    State.fileType = 'txt';
    const container = document.getElementById('epub-render-area');
    const txtContainer = document.getElementById('txt-render-area');
    if (container) container.style.display = 'none';
    if (txtContainer) txtContainer.style.display = 'block';

    const bodyEl = document.getElementById('txt-body');
    if (bodyEl) bodyEl.textContent = textContent;
    applyTxtStyles();

    generateTxtToc(textContent);

    State.isRestoringPosition = true;
    let targetProgress = 0;
    if (savedDescription) {
      try {
        const meta = JSON.parse(savedDescription);
        if (meta.progress) targetProgress = meta.progress;
      } catch (e) {}
    }

    setTimeout(() => {
      try {
        if (txtContainer) {
          const scrollHeight = txtContainer.scrollHeight - txtContainer.clientHeight;
          if (scrollHeight > 0 && targetProgress > 0) {
            txtContainer.scrollTop = targetProgress * scrollHeight;
          }
        }
      } catch (e) {}
      State.isRestoringPosition = false;
      hideLoading();
    }, 80);
  } catch (err) {
    console.error('[TXT Load Error]:', err);
    hideLoading();
  }
}

export function applyTxtStyles() {
  const bodyEl = document.getElementById('txt-body');
  if (!bodyEl) return;
  bodyEl.style.fontSize = `${State.settings.fontSize}px`;
  bodyEl.style.lineHeight = State.settings.lineHeight;
  bodyEl.style.fontFamily = getFontFamilyCss(State.settings.fontFamily);
}

export function generateTxtToc(text) {
  const lines = text.split('\n');
  const tocItems = [];
  const chapterRegex = /(제\s*\d+\s*[화장편목]|[0-9]+\s*[화장편]|Chapter\s*\d+|Prologue|Epilogue|프롤로그|에필로그)/i;

  let currentLineOffset = 0;
  for (let i = 0; i < Math.min(lines.length, 10000); i++) {
    const line = lines[i].trim();
    if (line.length > 0 && line.length < 50 && chapterRegex.test(line)) {
      tocItems.push({
        label: line,
        href: `#line-${i}`,
        lineIndex: i,
      });
      if (tocItems.length >= 80) break;
    }
    currentLineOffset += lines[i].length + 1;
  }

  State.toc = tocItems;
  renderToc(tocItems);
}

// Attach Scroll Tracker & Reliable Tap Detection
export function initTxtScrollTracker() {
  const txtArea = document.getElementById('txt-render-area');
  if (!txtArea) return;

  let lastScrollTop = 0;

  txtArea.addEventListener('scroll', () => {
    if (State.fileType !== 'txt' || State.isRestoringPosition) return;
    const scrollHeight = txtArea.scrollHeight - txtArea.clientHeight;
    if (scrollHeight <= 0) return;

    const ratio = txtArea.scrollTop / scrollHeight;
    const pct = Math.min(100, Math.max(0, ratio * 100));

    updateProgressUI(pct);

    scheduleDriveSync({
      type: 'txt',
      progress: ratio,
      scrollTop: txtArea.scrollTop,
      scrollHeight: scrollHeight,
      updatedAt: Date.now()
    });

    // Auto-hide toolbar while scrolling for full immersion
    const currentScrollTop = txtArea.scrollTop;
    if (Math.abs(currentScrollTop - lastScrollTop) > 12 && State.toolbarVisible) {
      setToolbarVisibility(false);
    }
    lastScrollTop = currentScrollTop;
  }, { passive: true });

  // Reliable Tap Detection on Screen to Toggle Menus without Double Triggering
  let isScrolling = false;
  let touchStartTime = 0;
  let touchStartPos = { x: 0, y: 0 };
  let lastTouchEndTime = 0;

  txtArea.addEventListener('touchstart', e => {
    isScrolling = false;
    touchStartTime = Date.now();
    if (e.touches && e.touches[0]) {
      touchStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }, { passive: true });

  txtArea.addEventListener('touchmove', e => {
    if (e.touches && e.touches[0]) {
      const moveDist = Math.hypot(e.touches[0].clientX - touchStartPos.x, e.touches[0].clientY - touchStartPos.y);
      if (moveDist > 10) {
        isScrolling = true;
      }
    }
  }, { passive: true });

  txtArea.addEventListener('touchend', e => {
    if (!isScrolling) {
      const elapsed = Date.now() - touchStartTime;
      const t = e.changedTouches && e.changedTouches[0] ? e.changedTouches[0] : null;
      let dist = 0;
      if (t) {
        dist = Math.hypot(t.clientX - touchStartPos.x, t.clientY - touchStartPos.y);
      }
      if (elapsed < 400 && dist < 20) {
        lastTouchEndTime = Date.now();
        toggleToolbar();
      }
    }
  }, { passive: true });

  // Desktop click support (ignores synthetic clicks following touch tap or active text selections)
  txtArea.addEventListener('click', () => {
    if (Date.now() - lastTouchEndTime < 450) return;
    const sel = window.getSelection();
    if (sel && sel.toString().trim().length > 0) return;
    toggleToolbar();
  });
}
