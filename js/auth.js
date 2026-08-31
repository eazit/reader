/**
 * Eazit Reader - Google Identity Services & Google Drive API v3 Integration
 */

import { CONFIG, State } from './config.js';
import { FileCache } from './cache.js';
import { decodeText } from './encoding.js';
import { showToast, showLoading, hideLoading, updateSyncBadge, updateAuthUI, openSettingsModal, saveLastRead, formatFileSize, escapeHtml } from './ui.js';
import { switchToReaderView } from './main.js';
import { loadEpubBook } from './reader-epub.js';
import { loadTxtBook } from './reader-txt.js';

let tokenClient = null;

export function initGIS() {
  if (typeof google === 'undefined' || !google.accounts || !google.accounts.oauth2) {
    console.warn('[GIS] Google Identity Services script not ready yet.');
    return;
  }

  const clientId = CONFIG.clientId;
  try {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: CONFIG.scopes,
      callback: handleTokenResponse,
    });
    console.log('[GIS] Token Client initialized successfully.');
  } catch (err) {
    console.error('[GIS] Failed to initialize Token Client:', err);
  }
}

// Auto-initialize when GSI script finishes loading
window.__onGsiLoaded = () => {
  console.log('[GIS] GSI script loaded via hook.');
  initGIS();
};

async function handleTokenResponse(response) {
  if (response.error) {
    console.error('[GIS] Auth Error:', response);
    if (State._silentAuth) {
      State._silentAuth = false;
      console.log('[GIS] Silent re-auth failed, staying logged out.');
      return;
    }
    const errText = response.error_description || response.error || '알 수 없는 오류';
    showToast(`로그인 실패: ${errText}`);
    updateSyncBadge('error', '로그인 오류');
    return;
  }

  if (response.access_token) {
    State.accessToken = response.access_token;
    State._silentAuth = false;

    const tokenData = {
      token: response.access_token,
      expiresAt: Date.now() + (response.expires_in || 3600) * 1000,
    };
    localStorage.setItem('eazit_auth_token', JSON.stringify(tokenData));

    updateAuthUI(true);
    showToast('Google 계정에 성공적으로 로그인되었습니다.');
    await loadDriveFiles();
  }
}

export function triggerGoogleLogin() {
  const currentClientId = CONFIG.clientId;
  if (!currentClientId || currentClientId.includes('YOUR_GOOGLE_CLIENT_ID')) {
    openSettingsModal();
    showToast('OAuth Client ID를 등록해주세요. (설정 하단)');
    return;
  }

  if (!tokenClient) {
    initGIS();
  }

  if (tokenClient) {
    try {
      tokenClient.requestAccessToken({ prompt: State.accessToken ? '' : 'select_account' });
    } catch (e) {
      console.error('[GIS] requestAccessToken error:', e);
      showToast('로그인 창을 여는 중 오류가 발생했습니다.');
    }
  } else {
    showToast('Google 인증 서비스를 준비 중입니다. 1~2초 후 다시 눌러주세요.');
  }
}

export function triggerGoogleLogout() {
  if (State.accessToken) {
    try {
      google.accounts.oauth2.revoke(State.accessToken, () => {
        console.log('[GIS] Token revoked.');
      });
    } catch (e) {}
  }

  State.accessToken = null;
  localStorage.removeItem('eazit_auth_token');
  State.driveFiles = [];

  updateAuthUI(false);
  renderDriveFileList([]);
  showToast('로그아웃 되었습니다.');
}

export async function tryRestoreSession() {
  const raw = localStorage.getItem('eazit_auth_token');
  if (!raw) return false;

  try {
    const data = JSON.parse(raw);
    if (data.token && data.expiresAt && Date.now() < data.expiresAt - 300000) {
      const res = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
        headers: { Authorization: `Bearer ${data.token}` }
      });
      if (res.ok) {
        State.accessToken = data.token;
        updateAuthUI(true);
        console.log('[Auth] Session restored from localStorage.');
        loadDriveFiles();
        return true;
      }
    }
  } catch (e) {}

  localStorage.removeItem('eazit_auth_token');
  if (tokenClient) {
    try {
      State._silentAuth = true;
      tokenClient.requestAccessToken({ prompt: '' });
    } catch (e) { State._silentAuth = false; }
  }
  return false;
}

export async function loadDriveFiles() {
  if (!State.accessToken) return;

  const container = document.getElementById('drive-files-container');
  if (container) {
    container.innerHTML = `<div class="empty-drive-state" style="grid-column: 1 / -1;">Google Drive에서 소설 목록을 불러오는 중...</div>`;
  }

  try {
    const query = encodeURIComponent("trashed = false and (name contains '.txt' or name contains '.epub' or mimeType = 'text/plain' or mimeType = 'application/epub+zip')");
    const fields = encodeURIComponent('files(id, name, mimeType, size, modifiedTime, description)');
    const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&pageSize=100&orderBy=modifiedTime desc`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${State.accessToken}` }
    });

    if (!res.ok) {
      if (res.status === 401) {
        triggerGoogleLogout();
        showToast('로그인이 만료되었습니다. 다시 로그인해주세요.');
      }
      throw new Error(`Drive API Error: ${res.statusText}`);
    }

    const data = await res.json();
    State.driveFiles = data.files || [];
    renderDriveFileList(State.driveFiles);
  } catch (err) {
    console.error('[Drive Files Error]:', err);
    if (container) {
      container.innerHTML = `<div class="empty-drive-state" style="grid-column: 1 / -1;">파일 목록을 불러오지 못했습니다. (${err.message})</div>`;
    }
  }
}

export function renderDriveFileList(files) {
  const container = document.getElementById('drive-files-container');
  if (!container) return;
  container.innerHTML = '';

  if (!files || files.length === 0) {
    container.innerHTML = `
      <div class="empty-drive-state" style="grid-column: 1 / -1;">
        Google Drive에서 읽을 수 있는 소설(.txt, .epub) 파일이 없습니다.<br>
        드라이브에 소설을 업로드한 후 새로고침을 눌러주세요.
      </div>
    `;
    return;
  }

  files.forEach(file => {
    const isEpub = file.name.toLowerCase().endsWith('.epub') || file.mimeType === 'application/epub+zip';
    const badgeClass = isEpub ? 'badge-epub' : 'badge-txt';
    const badgeText = isEpub ? 'EPUB' : 'TXT';

    let progressPct = 0;
    if (file.description) {
      try {
        const meta = JSON.parse(file.description);
        if (meta.progress) progressPct = Math.min(100, Math.max(0, meta.progress * 100));
      } catch (e) {}
    }

    const card = document.createElement('div');
    card.className = 'file-card';
    card.innerHTML = `
      <div class="file-card-top">
        <span class="file-type-badge ${badgeClass}">${badgeText}</span>
        <div style="flex: 1; min-width: 0;">
          <div class="file-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</div>
          <div class="file-meta">${formatFileSize(file.size)} • ${new Date(file.modifiedTime).toLocaleDateString()}</div>
        </div>
      </div>
      <div>
        <div class="file-card-bottom">
          <span style="color: var(--text-sub);">읽은 위치</span>
          <span style="font-weight: 700; color: var(--brand-primary);">${progressPct.toFixed(1)}%</span>
        </div>
        <div class="file-progress-bar">
          <div class="file-progress-fill" style="width: ${progressPct}%;"></div>
        </div>
      </div>
    `;

    card.addEventListener('click', () => openDriveFile(file));
    container.appendChild(card);
  });
}

export async function openDriveFile(file) {
  switchToReaderView(file.name);
  showLoading(`'${file.name}' 불러오는 중...`, 'Google Drive에서 데이터를 확인하고 있습니다');
  updateSyncBadge('saving', '불러오는 중...');

  try {
    const metaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?fields=id,name,mimeType,size,modifiedTime,description`, {
      headers: { Authorization: `Bearer ${State.accessToken}` }
    });
    const meta = await metaRes.json();

    let buffer = null;
    const cached = await FileCache.get(file.id);
    if (cached && cached.buffer) {
      const driveModified = new Date(meta.modifiedTime || 0).getTime();
      const cacheTime = cached.cachedAt || 0;
      if (cacheTime >= driveModified) {
        buffer = cached.buffer;
        console.log('[Cache] Hit! Loading from IndexedDB:', file.name);
        showLoading(`'${file.name}' 렌더링 중...`, '캐시에서 즉시 불러와 페이지를 구성합니다');
      }
    }

    if (!buffer) {
      console.log('[Cache] Miss. Downloading from Drive:', file.name);
      showLoading(`'${file.name}' 다운로드 중...`, 'Google Drive에서 전체 소설을 내려받고 있습니다');
      const dlRes = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
        headers: { Authorization: `Bearer ${State.accessToken}` }
      });
      if (!dlRes.ok) throw new Error('파일 다운로드 실패');
      buffer = await dlRes.arrayBuffer();

      FileCache.put(file.id, file.name, buffer, meta.description || '').catch(() => {});
    }

    const isEpub = file.name.toLowerCase().endsWith('.epub') || file.mimeType === 'application/epub+zip';

    State.currentFile = {
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      isLocal: false,
      buffer: buffer,
      description: meta.description || '',
    };

    showLoading(`'${file.name}' 준비 중...`, '읽던 위치를 동기화하고 있습니다');

    if (isEpub) {
      await loadEpubBook(buffer, meta.description);
    } else {
      const text = decodeText(buffer);
      State.currentFile.text = text;
      loadTxtBook(text, meta.description);
    }

    saveLastRead(file.id, file.name, false, meta.description || '');
    updateSyncBadge('saved', '동기화 연결됨');
  } catch (err) {
    console.error('[Drive Open Error]:', err);
    hideLoading();
    showToast(`파일 열기 실패: ${err.message}`);
    updateSyncBadge('error', '오류');
  }
}

export function scheduleDriveSync(payload) {
  if (!State.currentFile || State.currentFile.isLocal || !State.accessToken) {
    updateSyncBadge('local', '로컬 모드');
    return;
  }

  updateSyncBadge('saving', '저장 중...');
  if (State.syncTimer) clearTimeout(State.syncTimer);

  State.syncTimer = setTimeout(async () => {
    try {
      const url = `https://www.googleapis.com/drive/v3/files/${State.currentFile.id}`;
      const body = JSON.stringify({ description: JSON.stringify(payload) });

      const res = await fetch(url, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${State.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: body
      });

      if (!res.ok) throw new Error(`Sync Patch Failed (${res.status})`);
      State.lastSavedPayload = payload;
      updateSyncBadge('saved', '동기화 완료');
    } catch (err) {
      console.error('[Sync Error]:', err);
      updateSyncBadge('error', '동기화 실패');
    }
  }, CONFIG.syncDebounceTime);
}
