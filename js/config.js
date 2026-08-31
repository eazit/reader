/**
 * Eazit Reader - Configuration & Global Shared State
 */

// 1. OAuth & Environment Configuration
export const DEFAULT_CLIENT_ID = '807134190260-juj89dr6ieoc30k728r1gbi0s32h6ga2.apps.googleusercontent.com';

export const CONFIG = {
  clientId: localStorage.getItem('eazit_google_client_id') || DEFAULT_CLIENT_ID,
  scopes: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive',
  syncDebounceTime: 1000,
};

// 2. Global Application State
export const State = {
  currentView: 'library', // 'library' | 'reader'
  accessToken: null,
  userProfile: null,
  driveFiles: [],
  currentFile: null,      // { id, name, mimeType, isLocal, buffer, text, description }
  fileType: null,         // 'epub' | 'txt'
  
  // EPUB Instances
  book: null,
  rendition: null,
  toc: [],
  
  // Viewer Settings
  settings: {
    theme: localStorage.getItem('eazit_theme') || 'light',
    fontSize: parseInt(localStorage.getItem('eazit_fontSize') || '18', 10),
    fontFamily: localStorage.getItem('eazit_fontFamily') || 'sans',
    lineHeight: parseFloat(localStorage.getItem('eazit_lineHeight') || '1.8'),
    readMode: localStorage.getItem('eazit_readMode') || 'scroll', // 'scroll' | 'page'
    autoFullscreenMobile: localStorage.getItem('eazit_auto_fullscreen') !== 'false', // default true
  },

  // Sync Engine State
  syncTimer: null,
  isRestoringPosition: false,
  lastSavedPayload: null,
  
  // Toolbar Visibility in Reader
  toolbarVisible: true,
  _silentAuth: false,
};
