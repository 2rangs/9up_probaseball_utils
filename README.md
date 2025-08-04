
# ⚾ 9up 프로야구 유틸리티 사이트
<img width="1920" height="1080" alt="image" src="https://github.com/user-attachments/assets/0b216ebc-3ee3-496e-97bb-2a33e61c5f33" />

> **KBO 기반 야구 게임 유저를 위한 통합 전략 도우미**

**9up 프로야구 유틸리티 사이트**는 KBO 리그를 기반으로 한 야구 게임 유저들을 위해 설계된 웹 기반 유틸리티입니다. 다양한 선수 데이터를 쉽게 조회하고, 시너지 조합을 분석하며, 팀 빌딩에 최적화된 의사결정을 도와줍니다.

## 🔍 주요 기능

* **CSV 기반 선수 데이터 시각화**

  * 타자 / 투수 데이터 탭 전환 지원
  * 다양한 조건(이름, 시너지, 등급, 포지션 등)으로 필터링
  * 직관적인 UI로 조건 조합 탐색 가능

* **시너지 조합 및 포지션 구성 도우미**

  * 실제 야구 포지션 배치 UI
  * 다중 OR/AND 조건 조합 필터링
  * 팀/연도 기반 시너지 시뮬레이션

* **스타일과 사용자 경험에 중점**

  * Tailwind CSS 기반의 반응형 디자인
  * 다크 모드 대응
  * Lucide 아이콘 사용으로 직관적 인터페이스 구현

## 🧩 사용 기술 스택

* **Frontend**: Vue 3, Vite, Tailwind CSS
* **데이터 처리**: PapaParse (CSV 파싱)
* **아이콘**: Lucide Vue
* **디자인 시스템**: 사용자 정의 컴포넌트 및 테마

## 📁 프로젝트 구조 

```
├── public/
│   ├── assets/
│   ├── DB/
├── src/
│   ├── components/
│   ├── views/
│   └── App.vue
├── README.md
└── package.json
```

## 🚀 실행 방법

```bash
npm install
npm run dev
```

## 📌 향후 계획

* 시너지 자동 계산 및 추천 팀 구성 기능 추가
* 선수 비교 기능
* 성능 최적화 및 모바일 UI 개선

