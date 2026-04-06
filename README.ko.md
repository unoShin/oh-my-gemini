한국어 | [English](README.md)

# oh-my-gemini

**Gemini Code를 위한 멀티 에이전트 오케스트레이션. 학습 곡선 제로.**

*Gemini Code를 배우지 마세요. 그냥 OMG를 쓰세요.*

oh-my-gemini는 Google Gemini CLI를 위한 강력하고 확실한 멀티 에이전트 오케스트레이션 레이어입니다. 복잡한 소프트웨어 엔지니어링 작업을 아키텍트, QA 테스터, 디버거 등 32개의 전문 에이전트에게 자동으로 위임하며, tmux를 통해 이들의 작업을 병렬로 조율합니다.

---

## 🚀 빠른 시작 (로컬 설치 가이드)

현재 `oh-my-gemini`는 v5.0.0 정식 배포 전(Pre-release) 상태입니다. 사용을 원하신다면 로컬 환경에서 직접 빌드하여 플러그인으로 연결해야 합니다.

**요구사항:**
- Unix 환경 (macOS, Linux, 또는 Windows의 WSL2)
- `tmux` 설치됨 (`sudo apt install tmux` 또는 `brew install tmux`)
- [Gemini CLI](https://github.com/google-gemini/gemini-cli) 설치 및 인증 완료
- Node.js >= 20

**Step 1: 클론 및 빌드**
```bash
git clone https://github.com/unoShin/oh-my-gemini
cd oh-my-gemini
npm install
npm run build
```

**Step 2: Gemini 플러그인으로 등록**
작업할 프로젝트 디렉토리로 이동한 뒤, 다음과 같이 로컬 플러그인을 추가합니다:
```bash
gemini plugin add /절대/경로/oh-my-gemini
```

**Step 3: OMG 초기화**
```bash
/omg-setup
```

**Step 4: 무언가 만들기!**
```bash
team 3:executor "인증 모듈을 리팩토링하고 모든 타입스크립트 에러를 고쳐줘"
```

---

## 🔥 주요 기능

### Canonical Team Mode (팀 모드)
터미널에서 여러 Gemini 에이전트를 네이티브하게 실행하세요. `tmux` 분할 창을 통해 안전하고 확실하게 작업이 병렬화됩니다.
```bash
omg team 2:flash "이 코드의 예외 상황들을 리뷰해줘"
omg team 1:ultra "데이터베이스 스키마를 설계해줘"
```

### 매직 키워드 (Magic Keywords)
자연스럽게 대화하세요. oh-my-gemini가 당신의 명령을 분석하고 적절한 워크플로우를 즉시 가동합니다:
- **`ralph`**: 끈질긴 추적 모드. 모든 테스트가 통과되고 작업이 검증될 때까지 에이전트가 멈추지 않습니다.
- **`ulw` (ultrawork)**: 에이전트 최대 병렬 작업 모드를 켭니다.
- **`ralplan`**: 단 한 줄의 코드를 작성하기 전, 에이전트들끼리 협의하여 구조적인 계획을 수립합니다.

### 똑똑한 모델 라우팅 (v0.1.0 Humble Reset)
oh-my-gemini는 작업의 성격에 맞춰 적절한 모델 티어를 자동 선택합니다. 이제 더 이상 특정 모델 버전에 얽매이지 않고, 현재 사용자의 환경에서 가장 잘 작동하는 모델을 의도(Intention) 기반으로 라우팅합니다:
- **Flash (LOW)**: `gemini-3-flash` 계열. 단순 검색, 오타 수정 및 가벼운 git 작업.
- **Pro (MEDIUM)**: `gemini-3-pro` 계열. 일반적인 개발, 테스트 작문 및 디버깅.
- **Ultra (HIGH)**: `gemini-3-pro-high` 등. 복잡한 시스템 설계, 장기적인 추론 및 아키텍처 리뷰.

> **💡 모델 오버라이드 (Model Override)**
> 특정 모델을 강제하고 싶다면 환경 변수를 사용하세요:
> `export OMG_MODEL_HIGH=gemini-2.0-pro-exp`
> `export OMG_MODEL_MEDIUM=gemini-1.5-pro`
> `export OMG_MODEL_LOW=gemini-1.5-flash`

### HUD 상태 표시줄
에이전트들이 현재 어떤 작업을, 얼마나 했는지 상태바(HUD)를 통해 실시간으로 모니터링하세요.
```bash
/oh-my-gemini:hud setup
```

---

## 📚 문서 및 가이드
상세한 기능, 내부 도구 사용법, 그리고 모델 설정 방법은 로컬 문서로 제공됩니다.
- [전체 레퍼런스 가이드](docs/REFERENCE.md)
- [마이그레이션 가이드](docs/MIGRATION.md)

---

## 📝 라이선스
MIT License.

**영감을 받은 프로젝트들:** [oh-my-opencode](https://github.com/code-yeongyu/oh-my-opencode), [Superpowers](https://github.com/obra/superpowers), 그리고 [Ouroboros](https://github.com/Q00/ouroboros).
