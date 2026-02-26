import { h } from 'preact';
import { useState, useEffect, useRef, useCallback, useMemo } from 'preact/hooks';
import { FAB } from './FAB';
import { ChatPanel } from './ChatPanel';
import { HistorySidebar } from './HistorySidebar';
import { DesignSidebar } from './DesignSidebar';
import { WebSocketClient } from '../ws/client';
import { useDesignPicker } from '../hooks/useDesignPicker';
import { debounce } from '../utils/debounce';
import type { Message, FileChange, AIStatus, ServerMessage, CommitEntry, DesignElementInfo } from '../types';

const log = (msg: string, ...args: any[]) => console.log(`[BuildOver] ${msg}`, ...args);
const logWarn = (msg: string, ...args: any[]) => console.warn(`[BuildOver] ${msg}`, ...args);

const SESSION_KEY = 'buildover-session-id';

function getOrCreateSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

interface AppProps {
  wsUrl?: string;
  linkId?: string;
  basePath?: string;
  apiBase?: string;
}

export function App({ wsUrl, linkId, basePath, apiBase: explicitApiBase }: AppProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [fileChanges, setFileChanges] = useState<FileChange[]>([]);
  const [status, setStatus] = useState<AIStatus>('idle');
  const [statusMessage, setStatusMessage] = useState<string | undefined>();
  const [commits, setCommits] = useState<CommitEntry[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const wsRef = useRef<WebSocketClient | null>(null);
  const streamBufferRef = useRef<{ [messageId: string]: string }>({});

  const [mergeRequested, setMergeRequested] = useState(false);
  const [prLoading, setPrLoading] = useState(false);
  const [designMode, setDesignMode] = useState(false);
  const [selectedDesignElement, setSelectedDesignElement] = useState<DesignElementInfo | null>(null);
  const inlineOverridesRef = useRef<Map<string, Set<string>>>(new Map());

  const apiBase = explicitApiBase
    || (basePath
      ? `${window.location.protocol}//${window.location.host}${basePath}`
      : wsUrl
      ? wsUrl.replace(/^ws/, 'http').replace(/\/buildover\/ws$/, '')
      : '');

  const { isActive: designPickerActive, activate: activateDesignPicker, deactivate: deactivateDesignPicker } = useDesignPicker({
    onSelect: (info) => {
      setSelectedDesignElement(info);
    },
  });

  // Toggle design mode
  const handleDesignModeToggle = useCallback(() => {
    if (!designMode) {
      setDesignMode(true);
      activateDesignPicker();
    } else {
      deactivateDesignPicker();
      setSelectedDesignElement(null);
      setDesignMode(false);
    }
  }, [designMode, activateDesignPicker, deactivateDesignPicker]);

  // Debounced sender for design changes
  const debouncedSendDesignChange = useMemo(() => debounce((
    selector: string,
    property: string,
    value: string,
    oldValue: string,
    elementInfo: DesignElementInfo,
  ) => {
    wsRef.current?.send({
      type: 'design.change',
      selector,
      property,
      value,
      oldValue,
      elementInfo: {
        tagName: elementInfo.tagName,
        classes: elementInfo.classes,
        id: elementInfo.id,
        textContent: elementInfo.textContent,
        computedStyles: elementInfo.computedStyles,
      },
    });
  }, 800), []);

  const handleDesignPropertyChange = useCallback((property: string, value: string) => {
    if (!selectedDesignElement) return;
    const { selector } = selectedDesignElement;
    const oldValue = selectedDesignElement.computedStyles[
      property.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
    ] || '';

    // 1. Immediate visual feedback via inline style
    try {
      const el = document.querySelector(selector);
      if (el instanceof HTMLElement) {
        el.style.setProperty(property, value);
        // Track inline override
        if (!inlineOverridesRef.current.has(selector)) {
          inlineOverridesRef.current.set(selector, new Set());
        }
        inlineOverridesRef.current.get(selector)!.add(property);
      }
    } catch { /* selector may fail */ }

    // 2. Update local state so sidebar stays in sync
    const camelProp = property.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    setSelectedDesignElement(prev => prev ? {
      ...prev,
      computedStyles: { ...prev.computedStyles, [camelProp]: value },
    } : null);

    // 3. Debounced WebSocket send
    debouncedSendDesignChange(selector, property, value, oldValue, selectedDesignElement);
  }, [selectedDesignElement, debouncedSendDesignChange]);

  useEffect(() => {
    if (!wsUrl) {
      logWarn('No wsUrl provided, WebSocket disabled');
      return;
    }

    if (apiBase) {
      fetch(`${apiBase}/buildover/api/commits?limit=30`)
        .then(r => r.json())
        .then((data: CommitEntry[]) => {
          if (Array.isArray(data)) setCommits(data);
        })
        .catch(err => logWarn('Failed to fetch commits:', err));
    }

    const sessionId = getOrCreateSessionId();
    log(`Session ID: ${sessionId}`);

    log(`Connecting to WebSocket: ${wsUrl}`);
    const ws = new WebSocketClient(wsUrl, sessionId);
    wsRef.current = ws;

    ws.onMessage((message: ServerMessage) => {
      log(`Server message: type=${message.type}`, message);
      handleServerMessage(message);
    });

    ws.connect();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'B') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      ws.disconnect();
    };
  }, [wsUrl]);

  const handleServerMessage = useCallback((message: ServerMessage) => {
    switch (message.type) {
      case 'stream': {
        const msgId = message.messageId || 'default';
        const buffer = streamBufferRef.current;
        buffer[msgId] = (buffer[msgId] || '') + message.content;

        setMessages((prev) => {
          const existing = prev.find((m) => m.id === msgId && m.role === 'assistant');
          if (existing) {
            return prev.map((m) =>
              m.id === msgId && m.role === 'assistant'
                ? { ...m, content: buffer[msgId], streaming: true }
                : m
            );
          }
          return [
            ...prev,
            { id: msgId, role: 'assistant', content: buffer[msgId], timestamp: Date.now(), streaming: true },
          ];
        });
        break;
      }

      case 'stream.end': {
        const msgId = message.messageId;
        delete streamBufferRef.current[msgId];
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgId && m.role === 'assistant' ? { ...m, streaming: false } : m
          )
        );
        break;
      }

      case 'file.changed': {
        setFileChanges((prev) => [
          ...prev,
          { path: message.path, additions: message.additions, deletions: message.deletions, diff: message.diff },
        ]);
        // Clear inline overrides (HMR will apply the real source change)
        for (const [sel, props] of inlineOverridesRef.current.entries()) {
          try {
            const el = document.querySelector(sel);
            if (el instanceof HTMLElement) {
              for (const p of props) el.style.removeProperty(p);
            }
          } catch { /* ignore */ }
        }
        inlineOverridesRef.current.clear();
        break;
      }

      case 'status': {
        setStatus(message.status);
        setStatusMessage(message.message);
        break;
      }

      case 'error': {
        logWarn(`Error from server: ${message.message}`);
        setMessages((prev) => [
          ...prev,
          { id: `error-${Date.now()}`, role: 'assistant', content: `Error: ${message.message}`, timestamp: Date.now() },
        ]);
        setStatus('idle');
        break;
      }

      case 'commit.created': {
        setCommits((prev) => [message.commit, ...prev]);
        break;
      }

      case 'cleared': {
        log('Session cleared by server');
        setMessages([]);
        setFileChanges([]);
        setStatus('idle');
        setStatusMessage(undefined);
        streamBufferRef.current = {};
        break;
      }
    }
  }, []);

  const handleSend = useCallback((content: string, createBranch: boolean) => {
    const connected = wsRef.current?.isConnected() || false;
    if (!connected) logWarn('WebSocket not connected!');

    setMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, role: 'user', content, timestamp: Date.now() },
    ]);
    setFileChanges([]);
    setStatus('analyzing');
    setStatusMessage('AI가 요청을 분석하고 있어요...');

    wsRef.current?.send({ type: 'chat', content, createBranch });
  }, []);

  const handleClear = useCallback(() => {
    // Generate new sessionId so next reconnect starts fresh
    const newId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(SESSION_KEY, newId);

    // Tell server to clear the current session
    wsRef.current?.send({ type: 'clear' });
  }, []);

  const handleCreateLink = useCallback(async (): Promise<string> => {
    const res = await fetch(`${apiBase}/buildover/api/share/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (!data.url) throw new Error(data.error || 'Failed to create link');
    return data.url as string;
  }, [apiBase]);

  const handleCreatePR = useCallback(async () => {
    if (!linkId || !apiBase) return;
    setPrLoading(true);
    try {
      const res = await fetch(`${apiBase}/buildover/api/share/pr`, { method: 'POST' });
      const data = await res.json();
      if (data.mergeStatus === 'requested') {
        setMergeRequested(true);
      } else {
        logWarn('Merge request failed:', data.error);
      }
    } catch (err) {
      logWarn('Merge request error:', err);
    } finally {
      setPrLoading(false);
    }
  }, [linkId, apiBase]);

  return (
    <div className="buildover-container">
      <HistorySidebar
        commits={commits}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen((prev) => !prev)}
        apiBase={apiBase}
        isShareUser={!!linkId}
      />
      <FAB onClick={() => setIsOpen((prev) => !prev)} isOpen={isOpen} />
      <ChatPanel
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        messages={messages}
        fileChanges={fileChanges}
        status={status}
        statusMessage={statusMessage}
        onSend={handleSend}
        onClear={handleClear}
        prButton={linkId ? { loading: prLoading, requested: mergeRequested, onClick: handleCreatePR } : undefined}
        onCreateLink={!linkId ? handleCreateLink : undefined}
        designMode={designMode}
        onDesignModeToggle={handleDesignModeToggle}
      />
      <DesignSidebar
        isOpen={designMode}
        element={selectedDesignElement}
        onPropertyChange={handleDesignPropertyChange}
        onClose={handleDesignModeToggle}
      />
    </div>
  );
}
