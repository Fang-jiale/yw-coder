import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/globals.css'

// 全局错误处理 - 上报到主进程日志
window.onerror = (message, source, lineno, colno, error) => {
  const errorInfo: any = {
    message: String(message),
    source,
    lineno,
    colno,
  };

  // 如果有 Error 对象，记录更多详细信息
  if (error) {
    errorInfo.errorName = error.name;
    errorInfo.errorMessage = error.message;
    errorInfo.errorType = error.constructor?.name;
    errorInfo.stack = error.stack?.substring(0, 1000);

    // 如果是特定类型的错误，记录额外信息
    if (error instanceof TypeError) {
      errorInfo.errorCategory = 'TypeError';
    } else if (error instanceof ReferenceError) {
      errorInfo.errorCategory = 'ReferenceError';
    } else if (error instanceof SyntaxError) {
      errorInfo.errorCategory = 'SyntaxError';
    }
  }

  window.electronAPI?.logRenderEvent?.('renderer_window_error', errorInfo);
  return false;
};

// 资源加载错误监听（CSS、JS、图片等加载失败）
window.addEventListener('error', (event) => {
  const target = event.target as HTMLElement;
  // 只处理资源加载错误（script、link、img 等）
  if (target && (target.tagName === 'SCRIPT' || target.tagName === 'LINK' || target.tagName === 'IMG')) {
    const element = target as HTMLScriptElement | HTMLLinkElement | HTMLImageElement;
    window.electronAPI?.logRenderEvent?.('renderer_resource_load_error', {
      tagName: target.tagName,
      src: (element as any).src || (element as any).href || 'unknown',
      type: (element as any).type || 'unknown',
      message: event.message || 'Resource failed to load',
      filename: event.filename,
      lineno: event.lineno,
    });
  }
}, true); // 使用捕获阶段监听

// 未处理的 Promise 错误 - 上报到主进程日志
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  let errorInfo: any = {
    reasonType: typeof reason,
    constructorName: reason?.constructor?.name,
  };

  // 处理不同类型的 rejection 原因
  if (reason instanceof Error) {
    errorInfo.message = reason.message;
    errorInfo.errorName = reason.name;
    errorInfo.stack = reason.stack?.substring(0, 1000);
  } else if (reason instanceof Event) {
    // 处理 Event 对象（如资源加载失败）
    errorInfo.message = 'Event object in promise rejection';
    errorInfo.eventType = reason.type;

    // 尝试获取 target 的详细信息
    const target = reason.target as any;
    if (target) {
      errorInfo.targetType = target.constructor?.name;
      errorInfo.targetTagName = target.tagName;
      errorInfo.targetSrc = target.src;
      errorInfo.targetHref = target.href;
      errorInfo.targetCurrentSrc = target.currentSrc;
      errorInfo.targetLocalName = target.localName;
    }

    // 如果是 ErrorEvent，获取更多信息
    if (reason instanceof ErrorEvent) {
      errorInfo.errorMessage = reason.message;
      errorInfo.filename = reason.filename;
      errorInfo.lineno = reason.lineno;
      errorInfo.colno = reason.colno;
    }

    // 尝试序列化 Event 对象的其他属性
    try {
      const eventProps: any = {};
      for (const key of ['bubbles', 'cancelable', 'composed', 'defaultPrevented', 'eventPhase', 'isTrusted', 'timeStamp']) {
        if (key in reason) {
          eventProps[key] = (reason as any)[key];
        }
      }
      errorInfo.eventProps = eventProps;
    } catch {
      // 忽略序列化错误
    }
  } else if (typeof reason === 'string') {
    errorInfo.message = reason;
  } else {
    try {
      errorInfo.message = String(reason);
      errorInfo.json = JSON.stringify(reason)?.substring(0, 500);
    } catch {
      errorInfo.message = '[Unable to stringify reason]';
    }
  }

  window.electronAPI?.logRenderEvent?.('renderer_unhandled_rejection', errorInfo);
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
