# AI 공지 도우미

복사한 메시지로 회사 공지를 자동 생성하는 데스크톱 앱(로컬 AI).

## 설치 후 사용
1. [Releases](../../releases)에서 OS에 맞는 설치파일(`.dmg`/`.msi`/`.exe`)을 받아 설치.
2. 실행하면 최초 1회 AI 모델(약 9.6GB)을 자동 다운로드합니다(진행률 표시). 완료 후 바로 사용.
3. 이후에는 인터넷 없이 오프라인으로 동작합니다.

> Ollama 런타임이 앱에 내장되어 있어 별도 설치가 필요 없습니다.

## 개발
```bash
npm ci
bash scripts/fetch-ollama.sh   # (Windows는 scripts/fetch-ollama.ps1) 로컬 실행에 필요한 ollama 런타임 준비
npm run tauri dev
```
