/**
 * Eazit Reader - Plain Text (TXT) Novel Reader Engine
 */

import { State } from './config.js';
import { scheduleDriveSync } from './auth.js';
import { updateProgressUI, hideLoading, renderToc, getFontFamilyCss } from './ui.js';

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

// Attach Scroll Tracker
export function initTxtScrollTracker() {
  const txtArea = document.getElementById('txt-render-area');
  if (!txtArea) return;

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
  }, { passive: true });
}
