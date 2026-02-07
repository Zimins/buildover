# BuildOver - 제품 계획서

> `npx buildover dev` 한 줄로 원본 앱 + AI 채팅 위젯을 함께 띄우는 개발 도구

---

## 1. 제품 개요

### 핵심 가치
개발자가 아무 웹 프로젝트에서 `npx buildover dev`를 실행하면,
**원본 앱을 그대로 프록시하면서 AI 채팅 위젯이 자동 주입된 페이지**를 서빙한다.
`localhost:4100`에 접속하면 원본 앱이 보이고, 그 위에 채팅창이 떠 있다.
자연어로 요구사항을 입력하면 AI가 소스 코드를 직접 수정하고 실시간 반영.

### 핵심 컨셉: 프록시 Dev Server

`next dev`가 Next.js 앱을 서빙하듯, `buildover dev`가 **기존 앱을 감싸서 AI 능력을 입힌 버전**을 서빙한다.

```
next dev      → localhost:3000  (Next.js 앱)
buildover dev → localhost:4100  (원본 앱 + AI 채팅 위젯)
                     │
                     ├─ 원본 앱 (localhost:3000) 을 리버스 프록시
                     ├─ HTML에 채팅 위젯 스크립트 자동 주입
                     └─ WebSocket으로 AI 코드 수정 능력 제공
```

### 사용 시나리오

```
1. 개발자가 기존 dev server를 실행:
   $ npm run dev                    # localhost:3000 (기존 앱)

2. 다른 터미널에서 BuildOver 실행:
   $ npx buildover dev              # localhost:4100 (BuildOver)

3. BuildOver가 자동으로:
   - 프로젝트 프레임워크 감지 (Next.js, Vite, PHP, Docker 등)
   - 기존 dev server 포트 자동 감지 (3000, 5173, 8000 등)
   - 리버스 프록시 시작 (원본 앱을 그대로 보여줌)
   - HTML 응답에 채팅 위젯 스크립트 자동 주입
   - Claude Agent SDK 연결

4. 브라우저에서 localhost:4100 접속
   → 원본 앱이 그대로 보이고, 우측 하단에 채팅 위젯이 떠 있음

5. "로그인 폼에 이메일 유효성 검사 추가해줘" 입력
6. AI가 코드 분석 → 코드 수정 → HMR 자동 반영 (원본 dev server가 처리)
7. 변경사항 diff 확인 → 머지 또는 폐기
```

---

## 2. 아키텍처

### 전체 구조

```
Terminal 1 (기존)           Terminal 2 (BuildOver)
┌──────────────┐           ┌────────────────────────────────────┐
│  next dev    │           │  npx buildover dev                 │
│  (port 3000) │           │  (port 4100)                       │
│              │           │                                    │
│  기존 앱 서빙 │           │  ┌──────────────────────────────┐  │
│  + HMR       │◄──────────│──│  리버스 프록시               │  │
└──────────────┘  프록시    │  │  (원본 앱을 그대로 전달 +    │  │
                           │  │   HTML에 위젯 스크립트 주입)  │  │
                           │  ├──────────────────────────────┤  │
                           │  │  BuildOver Dev Server        │  │
                           │  │                              │  │
                           │  │  1. 프로젝트 분석/감지        │  │
                           │  │  2. WebSocket 서버            │  │
                           │  │  3. Claude Agent SDK          │  │
                           │  │  4. Git 브랜치 관리           │  │
                           │  │  5. 파일 변경 → HMR 자동      │  │
                           │  └──────────────────────────────┘  │
                           └──────────────┬─────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────┐
│                      User's Browser                          │
│                                                              │
│  접속: localhost:4100 (BuildOver)                             │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  원본 앱 (localhost:3000에서 프록시됨)                    │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │        원래 앱 화면 그대로 보임                     │  │  │
│  │  │        (모든 기능 정상 동작)                        │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  │                                                        │  │
│  │  ┌──────────────────────────────┐                      │  │
│  │  │  BuildOver Chat Widget  [◉]  │ ← 자동 주입됨        │  │
│  │  │  (Shadow DOM 격리)           │                      │  │
│  │  │                              │                      │  │
│  │  │  채팅 입력 ──WebSocket──→ BuildOver Dev Server      │  │
│  │  │           ←─스트리밍 응답──  (port 4100)            │  │
│  │  │                              │                      │  │
│  │  │  AI가 파일 수정 → HMR 자동 반영                     │  │
│  │  └──────────────────────────────┘                      │  │
│  └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**사용자는 localhost:4100 하나만 접속하면 된다.**
원본 앱이 그대로 보이고, 그 위에 채팅 위젯이 떠 있다.

### 핵심 흐름

```
[브라우저] → localhost:4100 (BuildOver 프록시 서버)
                │
                ├─ HTML 요청 → localhost:3000 (원본 앱)에 프록시
                │              + 응답 HTML에 <script> 위젯 자동 삽입
                ├─ /buildover/widget.js → 채팅 위젯 JS 서빙
                ├─ /buildover/ws → WebSocket 핸들링 (채팅)
                └─ 나머지 모든 요청 → localhost:3000으로 그대로 프록시

사용자 채팅 입력
    │
    ▼ (WebSocket via /buildover/ws)
BuildOver Dev Server
    │
    ├─→ Claude Agent SDK: 코드 분석 + 수정
    │       │
    │       ├─→ 파일 Read/Edit/Write (프로젝트 디렉토리)
    │       └─→ 스트리밍 응답 → WebSocket → 브라우저
    │
    ├─→ Git Manager: 브랜치 생성/커밋/diff
    │
    └─→ 파일 변경 발생
            │
            ▼
        기존 dev server (port 3000) 가 HMR 감지
            │
            ▼
        브라우저 자동 갱신 (BuildOver 프록시 통해 전달)
```

---

## 3. CLI 인터페이스

### 명령어 설계

```bash
# 기본 사용: 원본 앱 포트를 자동 감지하여 프록시
npx buildover dev

# 원본 앱 포트 명시 (자동 감지 실패 시)
npx buildover dev --target http://localhost:3000

# 옵션
npx buildover dev --port 4100          # BuildOver 서버 포트 (기본: 4100)
npx buildover dev --open               # 브라우저 자동 열기

# 정적 파일 프로젝트 (dev server 없이 직접 서빙)
npx buildover dev --serve .            # 현재 디렉토리를 파일 서버로 서빙 + 위젯

# 설정
npx buildover init                     # buildover.config.ts 생성
npx buildover auth                     # Anthropic API 키 설정

# 브랜치 관리
npx buildover branches                 # 활성 buildover 브랜치 목록
npx buildover cleanup                  # 오래된 브랜치 정리
```

### `buildover dev` 시작 시 동작

기본 동작이 **리버스 프록시**. 원본 dev server를 자동 감지하고,
`localhost:4100`에 접속하면 원본 앱 + 채팅 위젯이 함께 보임.

```
$ npx buildover dev

  ╔══════════════════════════════════════════════╗
  ║            BuildOver Dev Server              ║
  ╠══════════════════════════════════════════════╣
  ║                                              ║
  ║  감지된 프레임워크:  Next.js 15              ║
  ║  원본 앱 감지:      http://localhost:3000    ║
  ║  리로드 전략:       HMR (자동)               ║
  ║                                              ║
  ║  ✓ 리버스 프록시 시작                         ║
  ║  ✓ 채팅 위젯 자동 주입                        ║
  ║  ✓ Claude Agent SDK 연결                     ║
  ║                                              ║
  ║  ➜ http://localhost:4100 에서 확인하세요      ║
  ║    (원본 앱 + AI 채팅 위젯)                   ║
  ║                                              ║
  ╚══════════════════════════════════════════════╝

  Ready! Waiting for connections...
```

### 원본 앱 포트 자동 감지

BuildOver는 시작 시 원본 dev server의 포트를 자동으로 찾는다:

```typescript
async function detectDevServerPort(projectDir: string): Promise<number | null> {
  // 1. 알려진 포트를 순서대로 확인 (실제 응답 확인)
  const commonPorts = [3000, 5173, 5174, 8000, 8080, 4321, 3001];
  for (const port of commonPorts) {
    if (await isPortResponding(port)) return port;
  }

  // 2. package.json scripts에서 포트 힌트 파싱
  //    "dev": "next dev -p 3001" → 3001
  //    "dev": "vite --port 5174" → 5174
  const pkg = await readJSON(`${projectDir}/package.json`);
  const devScript = pkg.scripts?.dev || '';
  const portMatch = devScript.match(/(?:-p|--port)\s*(\d+)/);
  if (portMatch) return parseInt(portMatch[1]);

  // 3. 감지 실패 → 사용자에게 물어봄
  return null;  // CLI에서 --target 입력 요청
}
```

감지 실패 시:
```
$ npx buildover dev

  ⚠ 실행 중인 dev server를 찾을 수 없습니다.

  원본 앱의 URL을 지정해주세요:
  $ npx buildover dev --target http://localhost:3000

  또는 정적 파일을 직접 서빙하려면:
  $ npx buildover dev --serve .
```

### 프록시 동작 상세

```
[브라우저] → localhost:4100 (BuildOver 프록시 서버)
                │
                ├─ /buildover/widget.js → 채팅 위젯 JS 서빙
                ├─ /buildover/ws → WebSocket (채팅 통신)
                ├─ /buildover/api/* → BuildOver REST API (diff, branches 등)
                │
                └─ 그 외 모든 요청 → localhost:3000 (원본 앱)
                     │
                     └─ HTML 응답인 경우:
                        </body> 앞에 자동 삽입:
                        <script src="/buildover/widget.js"></script>
```

**BuildOver 전용 경로는 `/buildover/*` 네임스페이스** 아래에 격리되어
원본 앱의 라우팅과 절대 충돌하지 않음.

---

## 4. 설정 파일

```typescript
// buildover.config.ts (선택사항 - npx buildover init으로 생성)
import { defineConfig } from 'buildover';

export default defineConfig({
  // BuildOver 서버 포트 (이 포트로 접속하면 원본 앱 + 위젯이 보임)
  port: 4100,

  // 프레임워크 (자동 감지, 수동 오버라이드 가능)
  framework: 'auto', // 'nextjs' | 'vite' | 'php' | 'docker' | 'static' | 'auto'

  // 원본 dev server 설정
  target: {
    url: 'http://localhost:3000',  // 프록시 대상 (자동 감지됨, 수동 오버라이드)
    // 또는
    command: 'npm run dev',  // BuildOver가 원본 dev server도 함께 시작
  },

  // Git 설정
  git: {
    autoBranch: true,              // 채팅 시작 시 자동 브랜치 생성
    branchPrefix: 'buildover/',    // 브랜치 접두사
    autoCommit: true,              // 변경사항 자동 커밋
    useWorktree: false,            // worktree 사용 (MVP)
  },

  // AI 설정
  agent: {
    allowedTools: ['Read', 'Edit', 'Write', 'Glob', 'Grep'],
    // Bash 허용 시: allowedTools: ['Read', 'Edit', 'Write', 'Glob', 'Grep', 'Bash'],
    maxTokens: 200000,
    systemPrompt: '',              // 추가 시스템 프롬프트
  },

  // 보안
  security: {
    allowedPaths: ['src/', 'app/', 'pages/', 'components/', 'styles/'],
    blockedPaths: ['.env', '.git/', 'node_modules/'],
    blockedPatterns: ['password', 'secret', 'token'],
  },

  // 위젯 UI
  widget: {
    position: 'bottom-right',    // 'bottom-right' | 'bottom-left' | 'top-right'
    theme: 'auto',               // 'light' | 'dark' | 'auto'
    hotkey: 'Ctrl+Shift+B',     // 위젯 토글 단축키
  },

  // Docker 프로젝트용
  docker: {
    serviceName: 'app',          // docker-compose 서비스 이름
    sourceMount: './src:/app/src', // 소스 코드 마운트 경로
  },
});
```

---

## 5. Dev Server 내부 구조

### 프로젝트 구조

```
buildover/
├── packages/
│   ├── cli/                        # CLI 엔트리포인트
│   │   ├── src/
│   │   │   ├── index.ts            # bin 엔트리 (buildover 명령어)
│   │   │   ├── commands/
│   │   │   │   ├── dev.ts          # buildover dev
│   │   │   │   ├── init.ts         # buildover init
│   │   │   │   ├── auth.ts         # buildover auth
│   │   │   │   └── cleanup.ts      # buildover cleanup
│   │   │   └── config.ts           # buildover.config.ts 로더
│   │   └── package.json
│   │
│   ├── server/                     # Dev Server 코어
│   │   ├── src/
│   │   │   ├── server.ts           # HTTP + WebSocket 서버
│   │   │   ├── proxy.ts            # 리버스 프록시 (기본 동작)
│   │   │   ├── inject.ts           # HTML에 위젯 스크립트 자동 주입
│   │   │   ├── port-detect.ts      # 원본 dev server 포트 자동 감지
│   │   │   ├── session/
│   │   │   │   ├── manager.ts      # 세션 생명주기
│   │   │   │   └── store.ts        # 세션 상태 저장
│   │   │   ├── agent/
│   │   │   │   ├── claude.ts       # Claude Agent SDK 래퍼
│   │   │   │   ├── tools.ts        # 커스텀 도구 정의
│   │   │   │   └── prompt.ts       # 시스템 프롬프트 빌더
│   │   │   ├── git/
│   │   │   │   ├── branch.ts       # 브랜치 CRUD
│   │   │   │   ├── worktree.ts     # Worktree 관리
│   │   │   │   ├── diff.ts         # Diff 생성/포맷팅
│   │   │   │   └── merge.ts        # 머지/충돌 처리
│   │   │   ├── reload/
│   │   │   │   ├── detector.ts     # 프레임워크 감지
│   │   │   │   ├── strategies.ts   # 리로드 전략 매핑
│   │   │   │   └── browser.ts      # 브라우저 리로드 신호
│   │   │   └── middleware/
│   │   │       └── cors.ts         # CORS 설정
│   │   └── package.json
│   │
│   └── widget/                     # 채팅 위젯 (브라우저)
│       ├── src/
│       │   ├── index.ts            # 엔트리 (Shadow DOM 생성)
│       │   ├── components/
│       │   │   ├── App.tsx         # 위젯 루트 (Preact)
│       │   │   ├── ChatPanel.tsx   # 채팅 패널
│       │   │   ├── MessageList.tsx # 메시지 목록
│       │   │   ├── DiffViewer.tsx  # 코드 diff 표시
│       │   │   ├── FileCard.tsx    # 파일 변경 카드
│       │   │   ├── FAB.tsx         # 플로팅 액션 버튼
│       │   │   └── BranchBar.tsx   # 브랜치 상태 바
│       │   ├── ws/
│       │   │   └── client.ts       # WebSocket 클라이언트
│       │   ├── styles/
│       │   │   └── widget.css      # 위젯 스타일 (Shadow DOM 내부)
│       │   └── utils/
│       │       └── markdown.ts     # 스트리밍 마크다운 렌더러
│       ├── package.json
│       └── tsup.config.ts          # IIFE 번들 (widget.js)
│
├── buildover.config.ts             # 기본 설정 템플릿
├── package.json                    # monorepo root
├── pnpm-workspace.yaml
└── turbo.json
```

### Dev Server 시작 흐름

```typescript
// packages/cli/src/commands/dev.ts
async function devCommand(options: DevOptions) {
  // 1. 설정 로드
  const config = await loadConfig(process.cwd());

  // 2. 프로젝트 분석
  const framework = await detectFramework(process.cwd());
  console.log(`감지된 프레임워크: ${framework.name}`);

  // 3. API 키 확인
  const apiKey = await resolveApiKey(); // 환경변수 또는 keychain
  if (!apiKey) {
    console.log('API 키를 설정해주세요: npx buildover auth');
    process.exit(1);
  }

  // 4. 원본 dev server 포트 결정
  let targetUrl: string;

  if (options.serve) {
    // --serve 모드: BuildOver가 직접 정적 파일 서빙
    targetUrl = null; // 프록시 없이 직접 서빙
  } else if (options.target) {
    // --target 명시된 경우
    targetUrl = options.target;
  } else if (config.target?.command) {
    // config에 command가 있으면 dev server 시작
    const childProcess = spawn(config.target.command, { shell: true, stdio: 'inherit' });
    targetUrl = config.target.url || `http://localhost:${await waitForPort(childProcess)}`;
  } else {
    // 자동 감지
    const detectedPort = await detectDevServerPort(process.cwd());
    if (!detectedPort) {
      console.error('⚠ 실행 중인 dev server를 찾을 수 없습니다.');
      console.error('  npx buildover dev --target http://localhost:3000');
      process.exit(1);
    }
    targetUrl = `http://localhost:${detectedPort}`;
  }

  // 5. BuildOver 프록시 서버 시작
  const server = new BuildOverServer({
    port: options.port || config.port || 4100,
    targetUrl,                    // 프록시 대상 (원본 앱)
    projectDir: process.cwd(),
    framework,
    apiKey,
    config,
    serveStatic: options.serve,   // 정적 서빙 모드
  });

  await server.start();

  // 6. 시작 메시지 출력
  printStartupBanner(server);
  // → "http://localhost:4100 에서 확인하세요 (원본 앱 + AI 채팅 위젯)"
}
```

### WebSocket 메시지 프로토콜

```typescript
// 클라이언트 → 서버
type ClientMessage =
  | { type: 'chat'; content: string; createBranch?: boolean }
  | { type: 'action'; action: 'merge' | 'discard' | 'keep' }
  | { type: 'diff'; sessionId: string }
  | { type: 'branch.list' }
  | { type: 'session.resume'; sessionId: string };

// 서버 → 클라이언트
type ServerMessage =
  | { type: 'stream'; content: string }           // AI 응답 스트리밍
  | { type: 'stream.end' }                        // 스트리밍 완료
  | { type: 'file.changed'; files: FileChange[] } // 파일 변경 알림
  | { type: 'diff'; diff: DiffData }              // Diff 데이터
  | { type: 'branch.created'; name: string }      // 브랜치 생성됨
  | { type: 'branch.merged'; name: string }       // 머지 완료
  | { type: 'error'; message: string }             // 에러
  | { type: 'status'; state: AgentState }          // AI 상태 (분석중/수정중/완료)

type FileChange = {
  path: string;
  action: 'modified' | 'created' | 'deleted';
  insertions: number;
  deletions: number;
};

type AgentState = 'idle' | 'analyzing' | 'editing' | 'committing' | 'done';
```

### Claude Agent SDK 통합

```typescript
// packages/server/src/agent/claude.ts
import { query, ClaudeAgentOptions } from '@anthropic-ai/claude-agent-sdk';

class BuildOverAgent {
  constructor(
    private projectDir: string,
    private config: BuildOverConfig,
  ) {}

  async execute(
    userMessage: string,
    sessionId: string,
    onStream: (msg: ServerMessage) => void,
  ) {
    const workingDir = this.getWorkingDir(sessionId);

    const options: ClaudeAgentOptions = {
      allowed_tools: this.config.agent.allowedTools,
      working_directory: workingDir,
      system_prompt: this.buildSystemPrompt(sessionId),
    };

    onStream({ type: 'status', state: 'analyzing' });

    for await (const message of query(userMessage, options)) {
      // 파일 변경 감지
      if (message.type === 'tool_use' && ['Edit', 'Write'].includes(message.tool)) {
        onStream({ type: 'status', state: 'editing' });
      }

      // 텍스트 응답 스트리밍
      if (message.type === 'text') {
        onStream({ type: 'stream', content: message.content });
      }
    }

    // 변경된 파일 목록 전송
    const changes = await this.getChangedFiles(sessionId);
    if (changes.length > 0) {
      onStream({ type: 'file.changed', files: changes });
      onStream({ type: 'status', state: 'committing' });

      // 자동 커밋
      if (this.config.git.autoCommit) {
        await this.gitManager.autoCommit(sessionId, userMessage);
      }
    }

    onStream({ type: 'status', state: 'done' });
    onStream({ type: 'stream.end' });
  }

  private buildSystemPrompt(sessionId: string): string {
    return `You are BuildOver, an AI assistant modifying a live web application.

Working directory: ${this.getWorkingDir(sessionId)}
Framework: ${this.framework.name}
Branch: buildover/${sessionId}

Rules:
- Only modify files within the project directory
- Never modify .env, .git/, or node_modules/
- After making changes, briefly describe what you changed
- Write clean, production-quality code
- Preserve existing code style and conventions
${this.config.agent.systemPrompt || ''}`;
  }
}
```

---

## 6. 프레임워크별 동작

### 감지 & 리로드 전략

```typescript
// packages/server/src/reload/detector.ts
async function detectFramework(projectDir: string): Promise<Framework> {
  // 1. Docker 환경
  if (await exists(`${projectDir}/docker-compose.yml`)) {
    return analyzeDockerCompose(projectDir);
  }

  // 2. Node.js 기반
  if (await exists(`${projectDir}/package.json`)) {
    const pkg = await readJSON(`${projectDir}/package.json`);
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (deps.next)    return { name: 'Next.js',  reload: 'hmr-auto' };
    if (deps.nuxt)    return { name: 'Nuxt',     reload: 'hmr-auto' };
    if (deps.vite)    return { name: 'Vite',     reload: 'hmr-auto' };
    if (deps.vue)     return { name: 'Vue CLI',  reload: 'hmr-auto' };
    if (deps.react)   return { name: 'React',    reload: 'hmr-auto' };
    if (deps.svelte)  return { name: 'Svelte',   reload: 'hmr-auto' };
    if (deps.express) return { name: 'Express',  reload: 'nodemon-restart' };
  }

  // 3. PHP
  if (await exists(`${projectDir}/composer.json`)) {
    const composer = await readJSON(`${projectDir}/composer.json`);
    if (composer.require?.['laravel/framework']) return { name: 'Laravel', reload: 'instant' };
    return { name: 'PHP', reload: 'instant' };
  }
  if (await exists(`${projectDir}/wp-config.php`)) {
    return { name: 'WordPress', reload: 'instant' };
  }

  // 4. Python
  if (await exists(`${projectDir}/requirements.txt`) || await exists(`${projectDir}/pyproject.toml`)) {
    return { name: 'Python', reload: 'server-restart' };
  }

  // 5. Ruby
  if (await exists(`${projectDir}/Gemfile`)) {
    return { name: 'Rails', reload: 'zeitwerk-auto' };
  }

  // 6. Fallback
  return { name: 'Static', reload: 'websocket-inject' };
}
```

### 리로드 전략별 동작

| 전략 | 동작 | 대상 | BuildOver 역할 |
|------|------|------|----------------|
| `hmr-auto` | 파일 변경 → 프레임워크 HMR 자동 | React/Next/Vue/Vite/Svelte | 없음 (파일만 수정하면 됨) |
| `instant` | 다음 HTTP 요청에서 자동 반영 | PHP/Laravel/WordPress | 없음 (파일만 수정하면 됨) |
| `server-restart` | dev server 자동 재시작 | Django/Flask/Express | 없음 (dev server가 감지) |
| `zeitwerk-auto` | Zeitwerk이 자동 리로드 | Rails | 없음 (Rails가 감지) |
| `docker-watch` | Docker Compose Watch sync | Docker 앱 | compose watch 트리거 |
| `websocket-inject` | BuildOver가 리로드 신호 전송 | 정적 HTML, 기타 | **위젯이 리로드 신호 수신 → location.reload()** |
| `nodemon-restart` | nodemon/ts-node-dev 재시작 | Node.js 서버 | 없음 (nodemon이 감지) |

**핵심 인사이트**: 대부분의 프레임워크에서 BuildOver는 **파일만 수정하면 됨**.
기존 dev server의 HMR/리로드가 자동으로 처리. 특별한 리로드 로직은 정적 HTML에만 필요.

---

## 7. 프레임워크별 사용 가이드

### 7.1 Next.js / React / Vite (가장 간단)

```bash
# 터미널 1: 기존 dev server
npm run dev                 # localhost:3000

# 터미널 2: BuildOver (자동으로 :3000 감지 → 프록시)
npx buildover dev           # localhost:4100

# → localhost:4100 접속하면 원본 앱 + 채팅 위젯이 함께 보임
```

HMR이 자동으로 동작하므로 추가 설정 불필요.
AI가 파일을 수정하면 기존 dev server의 HMR이 자동 반영.

### 7.2 PHP / Laravel

```bash
# 터미널 1: PHP 개발 서버
php artisan serve           # localhost:8000

# 터미널 2: BuildOver (자동으로 :8000 감지)
npx buildover dev           # localhost:4100

# 감지 실패 시 수동 지정:
npx buildover dev --target http://localhost:8000
```

PHP는 파일 변경이 다음 요청에 바로 반영되므로 HMR 불필요.
OPcache 개발 설정 확인 필요: `opcache.revalidate_freq=0`

### 7.3 Docker 프로젝트

```bash
# 터미널 1: Docker
docker compose up           # localhost:3000

# 터미널 2: BuildOver
npx buildover dev           # localhost:4100 (자동 감지)
```

```yaml
# docker-compose.yml 필수 조건:
services:
  app:
    volumes:
      - ./src:/app/src    # ← 소스 코드 바인드 마운트 필수
    develop:
      watch:              # ← Docker Compose Watch 권장
        - action: sync
          path: ./src
          target: /app/src
```

BuildOver가 호스트의 소스 파일 수정 → volume mount로 컨테이너에 반영 → 컨테이너 내 dev server가 HMR.
volume mount가 없으면 BuildOver가 경고 메시지 출력.

### 7.4 정적 HTML (dev server 없는 프로젝트)

```bash
# BuildOver가 파일 서버 역할도 겸함 (프록시 대상 없음)
npx buildover dev --serve .
# → localhost:4100 에서 현재 디렉토리 서빙 + 위젯 + 자동 리로드
```

정적 파일의 경우 BuildOver가 파일 변경 감지 → WebSocket으로 브라우저에 리로드 신호.

### 7.5 WordPress

```bash
# Local WP 또는 Docker 기반 WordPress
npx buildover dev --target http://localhost:8080
# → localhost:4100 접속하면 WordPress 사이트 + 채팅 위젯
```

테마/플러그인 파일 수정 → 페이지 새로고침 시 반영.

---

## 8. Git 브랜치 관리

### 기본 동작

```
채팅 시작 시:
  ├─ [브랜치 생성 ON]  → buildover/20260207-add-login-form 브랜치 생성
  │                       AI가 이 브랜치에서 작업
  │                       변경사항 자동 커밋
  │
  └─ [브랜치 생성 OFF] → 현재 브랜치에서 직접 수정
                          (위험하지만 빠름)
```

### 브랜치 워크플로우

```typescript
// simple-git 사용
import simpleGit from 'simple-git';

class GitManager {
  private git;

  constructor(private projectDir: string) {
    this.git = simpleGit(projectDir);
  }

  async startSession(sessionId: string, description?: string) {
    const branchName = description
      ? `buildover/${slugify(description)}`
      : `buildover/sess-${sessionId}`;

    // 현재 브랜치에서 새 브랜치 생성
    await this.git.checkoutBranch(branchName, 'HEAD');
    return branchName;
  }

  async autoCommit(sessionId: string, chatMessage: string) {
    await this.git.add('.');
    await this.git.commit(`buildover: ${chatMessage.slice(0, 72)}`);
  }

  async getDiff(branchName: string) {
    const baseBranch = await this.getBaseBranch(branchName);
    return this.git.diff([`${baseBranch}...${branchName}`]);
  }

  async merge(branchName: string, strategy: 'squash' | 'merge' = 'squash') {
    const baseBranch = await this.getBaseBranch(branchName);
    await this.git.checkout(baseBranch);

    if (strategy === 'squash') {
      await this.git.raw(['merge', '--squash', branchName]);
      await this.git.commit(`Merge buildover changes from ${branchName}`);
    } else {
      await this.git.merge([branchName, '--no-ff']);
    }

    // 브랜치 정리
    await this.git.deleteLocalBranch(branchName, true);
  }

  async discard(branchName: string) {
    const baseBranch = await this.getBaseBranch(branchName);
    await this.git.checkout(baseBranch);
    await this.git.deleteLocalBranch(branchName, true);
  }
}
```

### Worktree 기반 세션 격리 (MVP)

동시 세션 지원이 필요할 때:

```
프로젝트/
├── .git/                    # 공유 git 히스토리
├── src/                     # 메인 워킹 디렉토리
└── ...

.buildover-worktrees/        # BuildOver 전용 (gitignore)
├── sess-abc123/             # 세션 1 worktree
│   ├── src/
│   └── ...
└── sess-def456/             # 세션 2 worktree
    ├── src/
    └── ...
```

---

## 9. 보안 고려사항

### 필수 보안 조치

1. **로컬 전용**: Dev server는 `127.0.0.1`에만 바인드 (외부 접근 차단)
2. **API 키**: 환경변수 `ANTHROPIC_API_KEY` 또는 시스템 키체인 저장
3. **파일 접근 제어**: `security.allowedPaths`/`blockedPaths`로 제한
4. **AI 도구 제한**: `--allowedTools`로 Read/Edit/Write만 기본 허용
5. **Git 안전장치**: main 직접 수정 금지 (브랜치 모드), 강제 push 차단
6. **프로세스 격리**: Claude Agent SDK가 프로젝트 디렉토리 밖 접근 차단

### 위험 요소

| 위험 | 영향 | 완화 방안 |
|------|------|-----------|
| AI가 잘못된 코드 작성 | 앱 동작 불량 | Git 브랜치 격리 + 즉시 롤백 |
| API 키 노출 | 과금 문제 | 키체인 저장 + .env는 gitignore |
| 무한 루프 코드 | 서버 자원 소모 | Agent 타임아웃 + 프로세스 제한 |
| 민감한 파일 수정 | 보안 취약점 | blockedPaths + blockedPatterns |
| 외부 네트워크 노출 | 무단 접근 | 127.0.0.1 바인딩 필수 |

---

## 10. 개발 로드맵

### Phase 0: 프로토타입 (1~2주)

> 목표: `npx buildover dev` → `localhost:4100` 접속 → 원본 앱 + 채팅 위젯 → 코드 수정 → HMR 반영

**범위**:
- [ ] CLI 엔트리 (`buildover dev` 명령어)
- [ ] 리버스 프록시 (원본 앱 프록시 + HTML에 위젯 자동 주입)
- [ ] 원본 dev server 포트 자동 감지 (또는 `--target`)
- [ ] `/buildover/*` 네임스페이스로 위젯 JS, WebSocket 서빙
- [ ] 최소 채팅 UI (Preact, Shadow DOM, FAB)
- [ ] Claude Agent SDK 연동 (파일 수정 + 스트리밍 응답)
- [ ] 기본 diff 표시 (텍스트 기반)
- [ ] 브랜치 생성/삭제 (simple-git, worktree 없이)

**제외**:
- Git worktree
- Docker 지원
- 설정 파일 (buildover.config.ts)
- 보안 하드닝
- `--serve` 정적 파일 모드

**결과물**: `npx buildover dev` 실행 → `localhost:4100` 접속 → Next.js 앱이 보이고 채팅 위젯이 떠있음 → "버튼 색상을 빨간색으로 바꿔줘" → 코드 수정 → HMR 자동 반영

**기술 스택**:
```
CLI:     commander + chalk
서버:    Express + ws (WebSocket)
위젯:    Preact + Shadow DOM
AI:      @anthropic-ai/claude-agent-sdk
Git:     simple-git
번들러:  tsup (위젯 → IIFE)
모노레포: pnpm workspace + turbo
```

### Phase 1: MVP (4~6주)

> 목표: 다양한 프레임워크에서 사용 가능한 안정적인 개발 도구

**Sprint 1 (Week 1-2): 코어 안정화**
- [ ] buildover.config.ts 설정 시스템
- [ ] 포트 자동 감지 고도화 (package.json 파싱, 프로세스 스캔)
- [ ] `--serve` 모드 (정적 파일 직접 서빙 + 위젯)
- [ ] 세션 관리 (생성, 재개, 종료, 히스토리)
- [ ] WebSocket 재연결 + 메시지 큐
- [ ] 프레임워크 감지 고도화 (10개 이상)
- [ ] 에러 핸들링 + 로깅 (pino)

**Sprint 2 (Week 3-4): UI/UX 고도화**
- [ ] Monaco Editor 기반 Diff Viewer
- [ ] 파일 변경 요약 카드
- [ ] 스트리밍 마크다운 렌더링
- [ ] 머지/폐기/브랜치 유지 워크플로우 UI
- [ ] 브랜치 선택적 생성 토글
- [ ] AI 상태 표시 (분석중 → 수정중 → 완료)
- [ ] 다크/라이트 테마
- [ ] 키보드 단축키 (Ctrl+Shift+B)

**Sprint 3 (Week 5-6): 확장 & 안정화**
- [ ] Git worktree 기반 동시 세션
- [ ] Docker 프로젝트 지원 (volume mount 감지 + 경고)
- [ ] PHP/Laravel 지원 확인
- [ ] 정적 HTML 지원 (`--serve` 모드)
- [ ] `buildover auth` (API 키 설정 마법사)
- [ ] `buildover cleanup` (브랜치 정리)
- [ ] NPM 패키지 발행 (`npx buildover dev` 동작)
- [ ] 보안 하드닝 (파일 접근 제한, localhost 바인딩)
- [ ] 설치/사용 가이드 문서

### MVP 기능 매트릭스

| 기능 | 프로토타입 | MVP |
|------|:----------:|:---:|
| `npx buildover dev` CLI | ✅ | ✅ |
| 리버스 프록시 (원본 앱 + 위젯) | ✅ | ✅ |
| 포트 자동 감지 | ✅ 기본 | ✅ 고도화 |
| 채팅 UI (FAB + 패널) | ✅ 기본 | ✅ 고도화 |
| AI 코드 수정 | ✅ | ✅ |
| 실시간 HMR 반영 | ✅ (Next.js) | ✅ (10+ FW) |
| Diff 뷰어 | 텍스트 | Monaco |
| 브랜치 관리 | 기본 | Worktree |
| 동시 세션 | ❌ | ✅ |
| 설정 파일 | ❌ | ✅ |
| Docker 지원 | ❌ | ✅ |
| PHP 지원 | ❌ | ✅ |
| `--serve` (정적) | ❌ | ✅ |
| 보안 | 기본 | 하드닝 |

### Phase 2: 성장 (이후)

> MVP 이후 사용자 피드백 기반

- AI 충돌 해결 (자동 머지 갈등 해소)
- 팀 협업 (여러 개발자 동시 사용)
- 클라우드 호스팅 (SaaS - API 키 없이 사용)
- VS Code 확장 연동
- CI/CD 통합 (PR 자동 생성)
- 자연어 → 테스트 코드 생성
- 비개발자 모드 (디자이너/PM이 직접 사용)
- 브라우저 확장 (Chrome Extension으로 아무 사이트에서나)
- `buildover deploy` (변경사항 스테이징 배포)

---

## 11. 구현 가능성 평가

### 확인된 사항 (✅ 구현 가능)

| 항목 | 근거 |
|------|------|
| Claude Agent SDK 프로그래밍 제어 | 공식 SDK 존재, headless 모드, 스트리밍 지원 |
| Dev Server CLI 패턴 | Next.js/Vite 등 검증된 패턴, commander로 구현 |
| 리버스 프록시 + 위젯 자동 주입 | http-proxy-middleware로 간단 구현, Vercel Toolbar과 동일 패턴 |
| 원본 앱 포트 자동 감지 | 알려진 포트 스캔 + package.json 파싱으로 구현 |
| 채팅 위젯 임베딩 | Intercom/Tawk.to 패턴, Shadow DOM으로 격리 |
| 파일 수정 → HMR | 대부분 프레임워크에서 파일 변경만으로 자동 HMR |
| WebSocket 실시간 통신 | ws 라이브러리로 간단 구현 |
| Git 브랜치 격리 | simple-git + worktree로 완전 격리 |

### 도전 과제 (⚠️ 주의 필요)

| 항목 | 난이도 | 설명 |
|------|--------|------|
| AI 응답 품질 | 높 | 프롬프트 엔지니어링 + 컨텍스트 관리 핵심 |
| 대규모 코드베이스 | 중 | 200K 토큰 한계, 선택적 파일 로딩 필요 |
| Docker 환경 연동 | 중 | volume mount 필수, 사용자 가이드 필요 |
| Worktree 디스크 사용량 | 중 | pnpm + 자동 정리로 완화 |
| 크로스 플랫폼 | 중 | macOS/Linux 우선, Windows 추후 |

### 결론

**구현 가능성: 높음 (High)**

핵심 기술 요소가 모두 존재하며, `next dev` / `vite dev` 와 동일한 Dev Server 패턴으로
개발자에게 익숙한 경험을 제공할 수 있음.

가장 큰 차별점은 **`npx buildover dev` 한 줄로 원본 앱 + AI 채팅이 결합된 환경**을 바로 쓸 수 있다는 점.
`localhost:4100` 하나만 접속하면 원본 앱이 그대로 보이면서 AI 코드 수정 능력이 바로 활성화됨.
기존 프로젝트에 코드 한 줄 수정 없이, 비침투적으로 AI 개발 도구를 입힐 수 있음.

---

## 12. 참고 자료

### Claude Code / Agent SDK
- [Claude Agent SDK (TypeScript)](https://github.com/anthropics/claude-agent-sdk-typescript)
- [Claude Agent SDK (Python)](https://github.com/anthropics/claude-agent-sdk-python)
- [Claude Code Headless Mode](https://code.claude.com/docs/en/headless)
- [claude-agent-server (WebSocket)](https://github.com/dzhng/claude-agent-server)
- [agentapi (HTTP)](https://github.com/coder/agentapi)

### 채팅 위젯 패턴
- [Intercom Installation](https://developers.intercom.com/installing-intercom/web/installation)
- [Shadow DOM Guide](https://www.courier.com/blog/how-to-use-the-shadow-dom-to-isolate-styles-on-a-dom-that-isnt-yours)
- [Streamdown (Streaming Markdown)](https://github.com/vercel/streamdown)

### 핫 리로드
- [Docker Compose Watch](https://docs.docker.com/compose/how-tos/file-watch/)
- [Vite HMR](https://vite.dev/guide/api-hmr)
- [Next.js Fast Refresh](https://nextjs.org/docs/architecture/fast-refresh)

### Git 관리
- [simple-git](https://github.com/steveukx/git-js)
- [Monaco Diff Editor](https://www.npmjs.com/package/@monaco-editor/react)
- [Git Worktrees](https://www.kenmuse.com/blog/using-git-worktrees-for-concurrent-development/)

### CLI 도구
- [commander (CLI framework)](https://github.com/tj/commander.js)
- [http-proxy-middleware](https://github.com/chimurai/http-proxy-middleware)
- [tsup (번들러)](https://github.com/egoist/tsup)
