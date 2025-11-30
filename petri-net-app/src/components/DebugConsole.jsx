import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';

const DebugConsole = forwardRef((props, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState([]);
  const [isEnabled, setIsEnabled] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const logsEndRef = useRef(null);
  const originalConsole = useRef({});

  // Expose methods to parent components
  useImperativeHandle(ref, () => ({
    enable: () => setIsEnabled(true),
    disable: () => setIsEnabled(false),
    toggle: () => setIsEnabled(prev => !prev),
    isEnabled: () => isEnabled,
    open: () => { setIsEnabled(true); setIsOpen(true); },
    close: () => setIsOpen(false),
  }), [isEnabled]);

  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (!isEnabled) return;

    // Store original console methods
    originalConsole.current = {
      log: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info,
    };

    // Override console methods
    const addLog = (level, args) => {
      const timestamp = new Date().toLocaleTimeString();
      const message = args.map(arg => {
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg, null, 2);
          } catch (e) {
            return String(arg);
          }
        }
        return String(arg);
      }).join(' ');

      setLogs(prev => [...prev, { level, message, timestamp, id: Date.now() + Math.random() }]);
    };

    console.log = (...args) => {
      originalConsole.current.log(...args);
      addLog('log', args);
    };

    console.error = (...args) => {
      originalConsole.current.error(...args);
      addLog('error', args);
    };

    console.warn = (...args) => {
      originalConsole.current.warn(...args);
      addLog('warn', args);
    };

    console.info = (...args) => {
      originalConsole.current.info(...args);
      addLog('info', args);
    };

    return () => {
      // Restore original console methods
      console.log = originalConsole.current.log;
      console.error = originalConsole.current.error;
      console.warn = originalConsole.current.warn;
      console.info = originalConsole.current.info;
    };
  }, [isEnabled]);

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [logs, isOpen]);

  const clearLogs = () => {
    setLogs([]);
  };

  const copyToClipboard = async () => {
    if (logs.length === 0) return;

    // Format logs as readable text
    const formattedLogs = logs.map(log => {
      return `[${log.timestamp}] ${log.level.toUpperCase()}: ${log.message}`;
    }).join('\n');

    // Add header with summary
    const header = `Debug Console Logs\nGenerated: ${new Date().toLocaleString()}\nTotal Messages: ${logs.length}\n\n`;
    const fullText = header + formattedLogs;

    try {
      // Use Clipboard API if available
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(fullText);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = fullText;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      }
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      // Show error feedback
      alert('Failed to copy to clipboard. Please try selecting the text manually.');
    }
  };

  const getLogColor = (level) => {
    switch (level) {
      case 'error': return 'text-red-600 bg-red-50 border-red-200';
      case 'warn': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'info': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-700 bg-gray-50 border-gray-200';
    }
  };

  // Don't show floating button when not enabled - it's controlled from the menu
  if (!isEnabled) {
    return null;
  }

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 z-[100] bg-purple-600 text-white px-4 py-3 rounded-full shadow-lg text-sm font-medium active:bg-purple-700 flex items-center gap-2"
        title={isOpen ? "Hide Console" : "Show Console"}
      >
        🐛 {isOpen ? 'Hide' : 'Show'}
      </button>

      {/* Console Panel */}
      {isOpen && (
        <div className="fixed bottom-20 right-4 z-[99] w-[calc(100vw-2rem)] sm:w-96 max-w-md h-64 sm:h-80 bg-white border-2 border-purple-300 rounded-lg shadow-2xl flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-2 bg-purple-600 text-white rounded-t-lg">
            <h3 className="text-sm font-semibold">Debug Console</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={copyToClipboard}
                disabled={logs.length === 0}
                className={`px-2 py-1 rounded text-xs active:opacity-80 transition-all ${
                  copySuccess 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : logs.length === 0
                    ? 'bg-gray-500 opacity-50 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
                title="Copy All Logs to Clipboard"
              >
                {copySuccess ? '✓ Copied!' : '📋 Copy'}
              </button>
              <button
                onClick={clearLogs}
                className="px-2 py-1 bg-purple-700 hover:bg-purple-800 rounded text-xs active:bg-purple-900"
                title="Clear Logs"
              >
                Clear
              </button>
              <button
                onClick={() => setIsEnabled(false)}
                className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs active:bg-red-800"
                title="Disable Console"
              >
                ×
              </button>
            </div>
          </div>

          {/* Logs Area */}
          <div className="flex-1 overflow-y-auto p-2 bg-gray-900 text-green-400 font-mono text-xs">
            {logs.length === 0 ? (
              <div className="text-gray-500 italic">No logs yet...</div>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className={`mb-1 p-1 rounded border-l-2 ${getLogColor(log.level)}`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-gray-500 text-[10px] flex-shrink-0">{log.timestamp}</span>
                    <span className="text-[10px] font-semibold uppercase flex-shrink-0">{log.level}:</span>
                    <span className="flex-1 break-words whitespace-pre-wrap">{log.message}</span>
                  </div>
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>

          {/* Footer */}
          <div className="p-2 bg-gray-100 border-t text-xs text-gray-600">
            {logs.length} message{logs.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </>
  );
});

DebugConsole.displayName = 'DebugConsole';

export default DebugConsole;

