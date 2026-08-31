/**
 * Eazit Reader - In-Book Content Search & Jump Engine (TXT & EPUB)
 */

import { State } from './config.js';
import { showToast } from './ui.js';

export const SearchEngine = {
  isOpen: false,
  query: '',
  matches: [],
  currentIndex: -1,

  open() {
    this.isOpen = true;
    const bar = document.getElementById('reader-search-bar');
    if (bar) bar.classList.add('open');
    const input = document.getElementById('search-input-field');
    if (input) {
      input.focus();
      // @ts-ignore
      input.select();
    }
  },

  close() {
    this.isOpen = false;
    const bar = document.getElementById('reader-search-bar');
    if (bar) bar.classList.remove('open');
    this.clear();
  },

  clear() {
    this.query = '';
    this.matches = [];
    this.currentIndex = -1;
    const badge = document.getElementById('search-count-badge');
    if (badge) badge.textContent = '0 / 0';
    
    if (State.fileType === 'txt' && State.currentFile && State.currentFile.text) {
      const bodyEl = document.getElementById('txt-body');
      if (bodyEl) bodyEl.textContent = State.currentFile.text;
    }
  },

  async execute(query) {
    this.query = query ? query.trim() : '';
    if (!this.query) {
      this.clear();
      return;
    }

    if (State.fileType === 'txt') {
      this.searchTxt(this.query);
    } else if (State.fileType === 'epub') {
      await this.searchEpub(this.query);
    }
  },

  searchTxt(query) {
    const rawText = State.currentFile ? State.currentFile.text : '';
    if (!rawText) return;

    const bodyEl = document.getElementById('txt-body');
    if (!bodyEl) return;

    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');

    const parts = rawText.split(regex);
    bodyEl.innerHTML = '';

    this.matches = [];
    let matchIdx = 0;

    parts.forEach(part => {
      if (part.toLowerCase() === query.toLowerCase()) {
        const mark = document.createElement('mark');
        mark.className = 'search-highlight';
        mark.textContent = part;
        mark.dataset.matchIndex = String(matchIdx);
        this.matches.push(mark);
        bodyEl.appendChild(mark);
        matchIdx++;
      } else {
        bodyEl.appendChild(document.createTextNode(part));
      }
    });

    if (this.matches.length > 0) {
      this.goToMatch(0);
    } else {
      this.currentIndex = -1;
      const badge = document.getElementById('search-count-badge');
      if (badge) badge.textContent = '0 / 0';
      showToast('검색 결과가 없습니다.');
    }
  },

  async searchEpub(query) {
    if (!State.book) return;
    showToast('EPUB 내 검색 중...');
    this.matches = [];

    try {
      const spine = State.book.spine.spineItems || [];
      const searchPromises = spine.map(item => {
        return item.load(State.book.load.bind(State.book)).then(() => {
          return item.find(query);
        }).finally(() => {
          item.unload();
        });
      });

      const results = await Promise.all(searchPromises);
      this.matches = results.flat();

      if (this.matches.length > 0) {
        this.goToMatch(0);
      } else {
        this.currentIndex = -1;
        const badge = document.getElementById('search-count-badge');
        if (badge) badge.textContent = '0 / 0';
        showToast('검색 결과가 없습니다.');
      }
    } catch (e) {
      console.error('[EPUB Search Error]:', e);
      showToast('검색 중 오류가 발생했습니다.');
    }
  },

  goToMatch(index) {
    if (this.matches.length === 0) return;
    this.currentIndex = (index + this.matches.length) % this.matches.length;
    const badge = document.getElementById('search-count-badge');
    if (badge) badge.textContent = `${this.currentIndex + 1} / ${this.matches.length}`;

    if (State.fileType === 'txt') {
      this.matches.forEach((m, i) => {
        m.classList.toggle('active-match', i === this.currentIndex);
      });

      const activeEl = this.matches[this.currentIndex];
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } else if (State.fileType === 'epub') {
      const match = this.matches[this.currentIndex];
      if (match && match.cfi && State.rendition) {
        State.rendition.display(match.cfi);
      }
    }
  },

  next() {
    if (this.matches.length === 0) return;
    this.goToMatch(this.currentIndex + 1);
  },

  prev() {
    if (this.matches.length === 0) return;
    this.goToMatch(this.currentIndex - 1);
  }
};
