# oh-my-gemini (omg)

**Simple Gemini-native productivity tool, inspired by Claude Code.**

`oh-my-gemini`는 클로드(Claude)의 훌륭한 개발자 도구 경험을 구글 제미나이(Gemini) 생태계에서도 누리고 싶어 시작된 프로젝트입니다. 클로드 코드와 같은 직관적이고 강력한 명령줄 인터페이스를 제미나이 모델을 통해서도 구현하고자 하는 소박한 열망에서 출발했습니다.

---

## 🙏 Credits & Thanks to

이 프로젝트는 오픈소스 커뮤니티의 선행 작업들 덕분에 탄생할 수 있었습니다.

특히 **허예찬 (@yeachan-heo)** 님의 [oh-my-claudecode](https://github.com/yeachan-heo/oh-my-claudecode) 레포지토리를 가장 많이 참고하고 의존하여 만들어졌습니다. 그가 보여준 선구적인 비전과 아키텍처에 깊은 존경과 감사를 표합니다. 

이 프로젝트는 그의 훌륭한 결과물 위에 제미나이만의 특색을 입히려는 작은 시도입니다.

---

## 🚀 Quick Start (v0.1.0 Early Access)

현재 `oh-my-gemini`는 첫 번째 정식 버전인 **v0.1.0** 상태입니다. 로컬에서 직접 빌드하여 사용해 보실 수 있습니다.

**요구 사항:**
- 유닉스 환경 (macOS, Linux, 또는 Windows WSL2)
- `tmux` 설치 (`sudo apt install tmux` 등)
- [Gemini CLI](https://github.com/google-gemini/gemini-cli) 설치 및 인증 완료
- Node.js >= 20

**1단계: 클론 및 빌드**
```bash
git clone https://github.com/unoShin/oh-my-gemini
cd oh-my-gemini
npm install
npm run build
```

**2단계: 플러그인 등록**
Gemini CLI를 사용하는 프로젝트 디렉토리에서 로컬 확장으로 추가합니다:
```bash
gemini plugin add /path/to/your/oh-my-gemini/clone
```

**3단계: 기동**
```bash
omg ask "이 코드의 성능을 개선할 수 있는 방법을 제안해줘"
```

---

## 📝 License
MIT License.

**Inspired by:** [oh-my-claudecode](https://github.com/yeachan-heo/oh-my-claudecode), [oh-my-opencode](https://github.com/code-yeongyu/oh-my-opencode), [Superpowers](https://github.com/obra/superpowers).
