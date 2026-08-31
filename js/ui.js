/**
 * Eazit Reader - UI Helpers, Modal Controls & Theme/Typography Manager
 */

import { State } from './config.js';
import { FileCache } from './cache.js';
import { decodeText } from './encoding.js';
import { applyEpubStyles, loadEpubBook } from './reader-epub.js';
import { applyTxtStyles, loadTxtBook } from './reader-txt.js';
import { switchToReaderView, switchToLibraryView } from './main.js';

let loadingSafetyTimer = null;

export function showToast(msg) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

export function showLoading(title = '소설 데이터를 불러오는 중...', subtext = '잠시만 기다려주세요') {
  const overlay = document.getElementById('reader-loading-overlay');
  const titleEl = document.getElementById('loading-title-text');
  const subEl = document.getElementById('loading-subtext');
  if (titleEl) titleEl.textContent = title;
  if (subEl) subEl.textContent = subtext;
  if (overlay) overlay.classList.add('active');

  if (loadingSafetyTimer) clearTimeout(loadingSafetyTimer);
  loadingSafetyTimer = setTimeout(() => {
    hideLoading();
  }, 3500);
}

export function hideLoading() {
  if (loadingSafetyTimer) {
    clearTimeout(loadingSafetyTimer);
    loadingSafetyTimer = null;
  }
  const overlay = document.getElementById('reader-loading-overlay');
  if (overlay) {
    overlay.classList.remove('active');
  }
}

export function updateSyncBadge(status, label) {
  const badge = document.getElementById('sync-status-badge');
  const text = document.getElementById('sync-status-text');
  if (badge) badge.className = `sync-badge ${status}`;
  if (text) text.textContent = label;
}

export function updateAuthUI(isLoggedIn) {
  const authBtn = document.getElementById('btn-google-auth');
  const authText = document.getElementById('google-auth-text');
  const logoutBtn = document.getElementById('btn-google-logout');
  if (isLoggedIn) {
    if (authText) authText.textContent = 'Google 연결됨';
    if (authBtn) authBtn.style.borderColor = 'var(--brand-primary)';
    if (logoutBtn) logoutBtn.style.display = '';
  } else {
    if (authText) authText.textContent = 'Google 로그인';
    if (authBtn) authBtn.style.borderColor = '';
    if (logoutBtn) logoutBtn.style.display = 'none';
  }
}

export function openToc() {
  document.getElementById('toc-overlay')?.classList.add('open');
  document.getElementById('toc-drawer')?.classList.add('open');
}

export function closeToc() {
  document.getElementById('toc-overlay')?.classList.remove('open');
  document.getElementById('toc-drawer')?.classList.remove('open');
}

export function openSettingsModal() {
  const input = document.getElementById('input-custom-client-id');
  if (input) {
    // @ts-ignore
    input.value = localStorage.getItem('eazit_google_client_id') || '';
  }
  document.getElementById('settings-modal')?.classList.add('open');
}

export function closeSettingsModal() {
  document.getElementById('settings-modal')?.classList.remove('open');
}

export function toggleToolbar() {
  setToolbarVisibility(!State.toolbarVisible);
}

export function setToolbarVisibility(visible) {
  State.toolbarVisible = visible;
  const topBar = document.getElementById('reader-top-bar');
  const bottomBar = document.getElementById('reader-bottom-bar');
  if (visible) {
    topBar?.classList.remove('hidden-toolbar');
    bottomBar?.classList.remove('hidden-toolbar');
  } else {
    topBar?.classList.add('hidden-toolbar');
    bottomBar?.classList.add('hidden-toolbar');
  }
}

export function updateProgressUI(pct) {
  const slider = document.getElementById('reader-progress-slider');
  const label = document.getElementById('reader-progress-label');
  if (slider) {
    // @ts-ignore
    slider.value = pct;
  }
  if (label) label.textContent = pct.toFixed(1) + '%';
}

export function renderToc(tocItems) {
  const list = document.getElementById('toc-items-list');
  if (!list) return;
  list.innerHTML = '';

  if (!tocItems || tocItems.length === 0) {
    list.innerHTML = `<li class="toc-item" style="color: var(--text-muted);">목차가 없습니다.</li>`;
    return;
  }

  tocItems.forEach(item => {
    const li = document.createElement('li');
    li.className = 'toc-item';
    li.textContent = item.label.trim();
    li.addEventListener('click', () => {
      if (State.fileType === 'epub' && State.rendition) {
        State.rendition.display(item.href);
      }
      closeToc();
      setToolbarVisibility(false);
    });
    list.appendChild(li);
  });
}

export function applyTheme(themeName) {
  State.settings.theme = themeName;
  localStorage.setItem('eazit_theme', themeName);
  document.documentElement.setAttribute('data-theme', themeName);

  document.querySelectorAll('#settings-theme-group .btn-group-item').forEach(btn => {
    // @ts-ignore
    btn.classList.toggle('active', btn.dataset.theme === themeName);
  });

  document.querySelectorAll('.theme-quick-buttons .theme-btn').forEach(btn => {
    // @ts-ignore
    btn.classList.toggle('active', btn.dataset.themeVal === themeName);
  });

  if (State.fileType === 'epub') applyEpubStyles();
  if (State.fileType === 'txt') applyTxtStyles();
}

export function setFontSize(size) {
  const newSize = Math.min(36, Math.max(12, size));
  State.settings.fontSize = newSize;
  localStorage.setItem('eazit_fontSize', String(newSize));

  const quickEl = document.getElementById('quick-font-size-text');
  if (quickEl) quickEl.textContent = `${newSize}px`;

  const modalEl = document.getElementById('modal-font-size-label');
  if (modalEl) modalEl.textContent = `${newSize}px`;

  if (State.fileType === 'epub') applyEpubStyles();
  if (State.fileType === 'txt') applyTxtStyles();
}

export function setReadMode(mode) {
  State.settings.readMode = mode;
  localStorage.setItem('eazit_readMode', mode);

  document.querySelectorAll('#settings-mode-group .btn-group-item').forEach(btn => {
    // @ts-ignore
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });

  const iconEl = document.getElementById('quick-read-mode-icon');
  const textEl = document.getElementById('quick-read-mode-text');
  if (iconEl) iconEl.textContent = mode === 'scroll' ? '📜' : '📖';
  if (textEl) textEl.textContent = mode === 'scroll' ? '상하 스크롤' : '좌우 페이지';

  if (State.fileType === 'epub' && State.currentFile && State.currentFile.buffer) {
    loadEpubBook(State.currentFile.buffer, State.lastSavedPayload ? JSON.stringify(State.lastSavedPayload) : State.currentFile.description);
  }
}

export function getFontFamilyCss(type) {
  if (type === 'serif') return 'var(--font-serif)';
  if (type === 'system') return 'var(--font-system)';
  return 'var(--font-sans)';
}

export function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function escapeHtml(str) {
  return (str || '').replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[m]));
}

// Recent Read Novel Banner
export function saveLastRead(fileId, fileName, isLocal, description) {
  const data = { fileId, fileName, isLocal, description: description || '', savedAt: Date.now() };
  localStorage.setItem('eazit_last_read', JSON.stringify(data));
  renderRecentBookBanner();
}

export function clearLastRead() {
  localStorage.removeItem('eazit_last_read');
  renderRecentBookBanner();
}

export function getLastRead() {
  try {
    const raw = localStorage.getItem('eazit_last_read');
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

export async function renderRecentBookBanner() {
  const container = document.getElementById('recent-book-container');
  if (!container) return;

  const last = getLastRead();
  if (!last || !last.fileId) {
    container.style.display = 'none';
    container.innerHTML = '';
    return;
  }

  let progressText = '읽던 위치';
  if (last.description) {
    try {
      const meta = JSON.parse(last.description);
      if (meta.progress) progressText = `${(meta.progress * 100).toFixed(1)}% 읽음`;
    } catch (e) {}
  }

  container.style.display = 'block';
  container.innerHTML = `
    <div class="recent-book-banner">
      <div class="recent-book-info">
        <div style="font-size: 0.75rem; font-weight: 700; color: var(--brand-primary); margin-bottom: 2px;">📖 최근 읽던 책 이어보기</div>
        <div class="recent-book-title" title="${escapeHtml(last.fileName)}">${escapeHtml(last.fileName)}</div>
        <div class="recent-book-meta">${progressText} • ${new Date(last.savedAt || Date.now()).toLocaleDateString()}</div>
      </div>
      <button class="btn btn-brand" id="btn-resume-recent" style="height: 38px; padding: 0 1rem; font-size: 0.85rem;">
        바로 읽기 ▶
      </button>
    </div>
  `;

  document.getElementById('btn-resume-recent')?.addEventListener('click', () => {
    resumeLastRead();
  });
}

export async function resumeLastRead() {
  const last = getLastRead();
  if (!last || !last.fileId) return;

  try {
    const cached = await FileCache.get(last.fileId);
    if (!cached || !cached.buffer) {
      showToast('저장된 로컬 캐시를 찾을 수 없습니다. 파일을 다시 열어주세요.');
      return;
    }

    switchToReaderView(last.fileName);
    showLoading(`'${last.fileName}' 이어읽는 중...`, '마지막 읽던 위치를 복원하고 있습니다');

    const isEpub = last.fileName.toLowerCase().endsWith('.epub');
    const buffer = cached.buffer;

    State.currentFile = {
      id: last.fileId,
      name: last.fileName,
      isLocal: last.isLocal,
      buffer: buffer,
      description: last.description || cached.meta || '',
    };

    if (isEpub) {
      await loadEpubBook(buffer, last.description || cached.meta || null);
    } else {
      const text = decodeText(buffer);
      State.currentFile.text = text;
      loadTxtBook(text, last.description || cached.meta || null);
    }

    if (!last.isLocal && State.accessToken) {
      updateSyncBadge('saved', '동기화 연결됨');
    } else {
      updateSyncBadge('local', '로컬 모드');
    }
  } catch (err) {
    console.error('[Resume Error]:', err);
    hideLoading();
    switchToLibraryView();
    showToast('소설을 불러오는 중 오류가 발생했습니다.');
  }
}
