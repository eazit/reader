/**
 * Eazit Reader - Main Application Entry Point & Event Wiring
 */

import { CONFIG, State } from './config.js';
import { FileCache } from './cache.js';
import { decodeText } from './encoding.js';
import { initGIS, triggerGoogleLogin, triggerGoogleLogout, tryRestoreSession, loadDriveFiles } from './auth.js';
import { loadEpubBook } from './reader-epub.js';
import { loadTxtBook, initTxtScrollTracker } from './reader-txt.js';
import { SearchEngine } from './search.js';
import { 
  applyTheme, setFontSize, setReadMode, showToast, showLoading,
  openToc, closeToc, openSettingsModal, closeSettingsModal, toggleToolbar, setToolbarVisibility,
  renderRecentBookBanner, saveLastRead, updateSyncBadge
} from './ui.js';

// Safe Event Listener Helper
export function safeOn(id, event, handler) {
  const el = document.getElementById(id);
  if (el) el.addEventListener(event, handler);
}

// Switch View Helpers
export function switchToReaderView(title) {
  State.currentView = 'reader';
  document.getElementById('view-library')?.classList.add('hidden-view');
  document.getElementById('view-reader')?.classList.add('active-view');
  const titleEl = document.getElementById('reader-title-text');
  if (titleEl) titleEl.textContent = title;
  setToolbarVisibility(true);
}

export function switchToLibraryView() {
  State.currentView = 'library';
  document.getElementById('view-reader')?.classList.remove('active-view');
  document.getElementById('view-library')?.classList.remove('hidden-view');
  
  if (State.rendition) {
    try { State.rendition.destroy(); } catch (e) {}
    State.rendition = null;
  }
  State.book = null;
  const epubArea = document.getElementById('epub-render-area');
  const txtArea = document.getElementById('txt-render-area');
  const txtBody = document.getElementById('txt-body');
  if (epubArea) epubArea.style.display = 'none';
  if (txtArea) txtArea.style.display = 'none';
  if (txtBody) txtBody.innerHTML = '';
}

// Navigation Helpers (Prev / Next Page & Smooth Scroll Step)
export function prevPage() {
  if (State.fileType === 'epub' && State.rendition) {
    if (State.settings.readMode === 'scroll') {
      const container = document.getElementById('epub-render-area');
      container?.scrollBy({ top: -window.innerHeight * 0.8, behavior: 'smooth' });
    } else {
      State.rendition.prev();
    }
  } else if (State.fileType === 'txt') {
    const container = document.getElementById('txt-render-area');
    container?.scrollBy({ top: -window.innerHeight * 0.8, behavior: 'smooth' });
  }
}

export function nextPage() {
  if (State.fileType === 'epub' && State.rendition) {
    if (State.settings.readMode === 'scroll') {
      const container = document.getElementById('epub-render-area');
      container?.scrollBy({ top: window.innerHeight * 0.8, behavior: 'smooth' });
    } else {
      State.rendition.next();
    }
  } else if (State.fileType === 'txt') {
    const container = document.getElementById('txt-render-area');
    container?.scrollBy({ top: window.innerHeight * 0.8, behavior: 'smooth' });
  }
}

// Local File Handler
export function handleLocalFileInput(file) {
  if (!file) return;
  const localId = 'local_' + Date.now();
  switchToReaderView(file.name);
  showLoading(`'${file.name}' 불러오는 중...`, '로컬 파일을 준비하고 있습니다');

  const reader = new FileReader();
  const isEpub = file.name.toLowerCase().endsWith('.epub');

  reader.onload = async (e) => {
    // @ts-ignore
    const buffer = e.target.result;
    State.currentFile = {
      id: localId,
      name: file.name,
      isLocal: true,
      buffer: buffer,
    };

    FileCache.put(localId, file.name, buffer, '').catch(() => {});

    if (isEpub) {
      await loadEpubBook(buffer, null);
    } else {
      const text = decodeText(buffer);
      State.currentFile.text = text;
      loadTxtBook(text, null);
    }
    saveLastRead(localId, file.name, true, '');
    updateSyncBadge('local', '로컬 파일');
  };

  reader.readAsArrayBuffer(file);
}

// Touch & Swipe Gesture Handling
let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;

export function handleTouchStart(e) {
  if (State.currentView !== 'reader') return;
  const touch = e.touches ? e.touches[0] : e;
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
  touchStartTime = Date.now();
}

export function handleTouchEnd(e) {
  if (State.currentView !== 'reader') return;
  const touch = e.changedTouches ? e.changedTouches[0] : e;
  const diffX = touch.clientX - touchStartX;
  const diffY = touch.clientY - touchStartY;
  const elapsed = Date.now() - touchStartTime;

  if (elapsed < 500) {
    if (Math.abs(diffX) > Math.abs(diffY)) {
      if (Math.abs(diffX) > 50) {
        if (diffX > 0) prevPage();
        else nextPage();
      }
    } else {
      if (State.settings.readMode === 'page' && Math.abs(diffY) > 50) {
        if (diffY < 0) nextPage();
        else prevPage();
      }
    }
  }
}

// Application Lifecycle Bootstrapping
window.addEventListener('DOMContentLoaded', () => {
  // Ensure default state is clean library view
  switchToLibraryView();

  // Apply saved theme & typography
  applyTheme(State.settings.theme);
  setFontSize(State.settings.fontSize);
  setReadMode(State.settings.readMode);

  // Initialize TXT Scroll Tracker
  initTxtScrollTracker();

  // Initialize GIS
  initGIS();

  // Register Service Worker for PWA (Standalone mobile app mode)
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').then(reg => {
        console.log('[PWA] Service Worker registered successfully:', reg.scope);
      }).catch(err => {
        console.log('[PWA] Service Worker registration failed:', err);
      });
    });
  }

  // Restore session & Render recent book banner
  (async () => {
    await tryRestoreSession();
    await renderRecentBookBanner();
  })();

  // Auth Buttons
  safeOn('btn-google-auth', 'click', triggerGoogleLogin);
  safeOn('btn-google-logout', 'click', triggerGoogleLogout);
  safeOn('btn-hero-connect-drive', 'click', triggerGoogleLogin);
  safeOn('btn-refresh-drive', 'click', loadDriveFiles);

  // Local File Triggers
  const fileInput = document.getElementById('local-file-input');
  safeOn('btn-hero-open-local', 'click', (e) => {
    e.stopPropagation();
    fileInput?.click();
  });
  safeOn('library-dropzone', 'click', (e) => {
    e.stopPropagation();
    fileInput?.click();
  });
  if (fileInput) {
    fileInput.addEventListener('change', e => {
      // @ts-ignore
      if (e.target.files && e.target.files.length > 0) {
        // @ts-ignore
        handleLocalFileInput(e.target.files[0]);
      }
    });
  }

  // Drag & Drop
  const dropzone = document.getElementById('library-dropzone');
  if (dropzone) {
    ['dragenter', 'dragover'].forEach(name => {
      dropzone.addEventListener(name, e => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add('dragover');
      });
    });
    ['dragleave', 'drop'].forEach(name => {
      dropzone.addEventListener(name, e => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('dragover');
      });
    });
    dropzone.addEventListener('drop', e => {
      e.preventDefault();
      e.stopPropagation();
      const files = e.dataTransfer ? e.dataTransfer.files : null;
      if (files && files.length > 0) {
        handleLocalFileInput(files[0]);
      }
    });
  }

  // 3-Zone Touch Controls
  safeOn('touch-left', 'click', prevPage);
  safeOn('touch-center', 'click', toggleToolbar);
  safeOn('touch-right', 'click', nextPage);

  // Keyboard Shortcuts
  window.addEventListener('keydown', e => {
    if (State.currentView !== 'reader') return;
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') prevPage();
    if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') nextPage();
    if (e.key === 'Escape') {
      if (SearchEngine.isOpen) SearchEngine.close();
      else switchToLibraryView();
    }
  });

  // Touch Listeners
  window.addEventListener('touchstart', handleTouchStart, { passive: true });
  window.addEventListener('touchend', handleTouchEnd, { passive: true });

  // Reader Progress Slider
  const progressSlider = document.getElementById('reader-progress-slider');
  if (progressSlider) {
    progressSlider.addEventListener('input', e => {
      // @ts-ignore
      const pct = parseFloat(e.target.value);
      const label = document.getElementById('reader-progress-label');
      if (label) label.textContent = pct.toFixed(1) + '%';
      if (State.fileType === 'txt') {
        const container = document.getElementById('txt-render-area');
        if (container) {
          const scrollHeight = container.scrollHeight - container.clientHeight;
          container.scrollTop = (pct / 100) * scrollHeight;
        }
      }
    });
  }

  // Back to Library
  safeOn('btn-back-to-library', 'click', () => {
    SearchEngine.close();
    switchToLibraryView();
  });

  // TOC Drawer
  safeOn('btn-open-toc', 'click', openToc);
  safeOn('btn-close-toc', 'click', closeToc);
  safeOn('toc-overlay', 'click', closeToc);

  // In-Book Search Triggers
  safeOn('btn-open-search', 'click', () => {
    if (SearchEngine.isOpen) SearchEngine.close();
    else SearchEngine.open();
  });
  safeOn('btn-close-search', 'click', () => SearchEngine.close());
  safeOn('btn-search-next', 'click', () => SearchEngine.next());
  safeOn('btn-search-prev', 'click', () => SearchEngine.prev());

  const searchInput = document.getElementById('search-input-field');
  let searchDebounceTimer = null;
  if (searchInput) {
    searchInput.addEventListener('input', e => {
      if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        // @ts-ignore
        SearchEngine.execute(e.target.value);
      }, 300);
    });

    searchInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) SearchEngine.prev();
        else SearchEngine.next();
      } else if (e.key === 'Escape') {
        SearchEngine.close();
      }
    });
  }

  // Settings Modal Triggers
  safeOn('btn-library-settings', 'click', openSettingsModal);
  safeOn('btn-reader-settings', 'click', openSettingsModal);
  safeOn('btn-close-settings', 'click', closeSettingsModal);
  safeOn('settings-modal', 'click', (e) => {
    if (e.target === document.getElementById('settings-modal')) {
      closeSettingsModal();
    }
  });

  // Modal Font Size Buttons
  safeOn('btn-modal-font-dec', 'click', () => setFontSize(State.settings.fontSize - 1));
  safeOn('btn-modal-font-inc', 'click', () => setFontSize(State.settings.fontSize + 1));

  // Modal Reading Mode Buttons
  document.querySelectorAll('#settings-mode-group .btn-group-item').forEach(btn => {
    btn.addEventListener('click', () => {
      // @ts-ignore
      setReadMode(btn.dataset.mode);
      // @ts-ignore
      showToast(btn.dataset.mode === 'scroll' ? '상하 스크롤 모드로 전환되었습니다.' : '좌우 페이지 넘김 모드로 전환되었습니다.');
    });
  });

  // Modal Theme Switcher Buttons
  document.querySelectorAll('#settings-theme-group .btn-group-item').forEach(btn => {
    btn.addEventListener('click', () => {
      // @ts-ignore
      applyTheme(btn.dataset.theme);
    });
  });

  // Modal Font Family Buttons
  document.querySelectorAll('#settings-font-group .btn-group-item').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#settings-font-group .btn-group-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      // @ts-ignore
      State.settings.fontFamily = btn.dataset.font;
      // @ts-ignore
      localStorage.setItem('eazit_fontFamily', btn.dataset.font);
      if (State.fileType === 'epub') applyEpubStyles();
      if (State.fileType === 'txt') applyTxtStyles();
    });
  });

  // Modal Line Height Buttons
  document.querySelectorAll('#settings-lh-group .btn-group-item').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#settings-lh-group .btn-group-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      // @ts-ignore
      const lh = parseFloat(btn.dataset.lh);
      State.settings.lineHeight = lh;
      localStorage.setItem('eazit_lineHeight', String(lh));
      if (State.fileType === 'epub') applyEpubStyles();
      if (State.fileType === 'txt') applyTxtStyles();
    });
  });

  // Custom Client ID Save
  safeOn('btn-save-custom-client', 'click', () => {
    // @ts-ignore
    const val = document.getElementById('input-custom-client-id')?.value.trim();
    CONFIG.clientId = val;
    initGIS();
    showToast('OAuth Client ID가 설정되었습니다.');
    closeSettingsModal();
  });
});
