<p align="center">
  <img src="assets/logo.png" width="120" height="120" alt="Eazit Reader Logo" style="border-radius: 24px;" />
</p>

# Eazit Reader (이지릿 리더)

> Google Drive 실시간 동기화 & 고속 오프라인 캐시를 지원하는 차세대 크로스 플랫폼 웹소설(.txt) 및 전자책(.epub) 뷰어

![Eazit Reader](https://img.shields.io/badge/version-1.0.0-0ea5e9.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

---

## ✨ 핵심 기능

1. **Google Drive 클라우드 자동 동기화**
   - Google Drive API v3 및 Google Identity Services(GIS) 연동
   - PC, 태블릿, 모바일 등 어떤 기기에서 접속해도 읽던 페이지(EPUB CFI)와 스크롤 위치(TXT)가 실시간으로 자동 동기화
   - 파일 메타데이터 기반 스마트 디바운스 동기화

2. **IndexedDB 로컬 고속 캐시 (FileCache)**
   - 한 번 열어본 소설은 브라우저 로컬 저장소에 안전하게 캐싱
   - 재접속 시 네트워크 다운로드 없이 0.1초 즉시 로딩 및 오프라인 읽기 지원

3. **강력한 한국어 인코딩 자동 감지**
   - BOM 검출 → 엄격한 UTF-8 → EUC-KR / CP949 자동 판별 fallback 체인
   - 오래된 텍스트 소설의 한글 깨짐 현상 완벽 방지

4. **이지뷰어(EasyViewer) 스타일의 스마트 터치 & 제스처**
   - 3분할 터치 제스처 (좌: 이전 페이지 / 중: 메뉴 토글 / 우: 다음 페이지)
   - 모바일 스와이프 제스처 (상하/좌우 쓸어넘기기) 및 PC 키보드 단축키 지원

5. **2가지 독서 모드 & 맞춤형 뷰어 설정**
   - **상하 연속 스크롤 모드**: 웹소설에 최적화된 매끄러운 스크롤
   - **좌우 페이지 넘김 모드**: 단행본/종이책 느낌의 페이지 단위 넘김
   - 라이트 / 세피아(아이보리) / 다크(딥네이비) 3대 테마
   - Pretendard 고딕 / Noto Serif 명조 서체 및 글자 크기, 줄 간격 미세 조정

6. **본문 실시간 검색 (SearchEngine)**
   - 텍스트 및 EPUB 본문 내 키워드 실시간 하이라이트 및 결과 순차 점프 (`Enter` / `Shift+Enter`)

---

## 📁 프로젝트 구조

```text
eazit_reader/
├── index.html                  # 메인 HTML 마크업
├── css/                        # 모듈형 스타일시트
│   ├── base.css                # 디자인 토큰, 테마, 글로벌 컴포넌트
│   ├── library.css             # 서재 허브 및 파일 그리드 스타일
│   ├── reader.css              # 뷰어 본문 캔버스 및 툴바 스타일
│   ├── search.css              # 본문 검색창 및 하이라이트
│   └── modal.css               # 목차 드로어, 설정 모달, 로딩 오버레이
└── js/                         # 모듈형 JavaScript (ES6)
    ├── config.js               # 앱 전역 설정 및 State
    ├── cache.js                # IndexedDB 로컬 캐시 엔진
    ├── encoding.js             # 한국어 인코딩 판별기
    ├── auth.js                 # GIS 인증 및 Drive API 연동
    ├── reader-txt.js           # TXT 소설 렌더러
    ├── reader-epub.js          # EPUB 렌더러 (ePub.js)
    ├── search.js               # 본문 검색 엔진
    ├── ui.js                   # UI/테마/모달 컨트롤러
    └── main.js                 # 메인 진입점 및 이벤트 바인딩
```

---

## 🚀 로컬 실행 방법

```bash
# Python 내장 웹 서버 실행 (포트 8080)
python -m http.server 8080

# 브라우저 접속
http://localhost:8080/index.html
```

---

## 📄 라이선스
MIT License
