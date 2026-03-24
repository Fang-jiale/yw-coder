# 性能优化指南

## 对话界面性能优化实践

本文档总结了对标 Trae 的对话界面性能优化方案。

---

## 1. 渲染性能优化

### 1.1 React Hooks 优化

#### useMemo - 缓存计算结果

```typescript
// ✅ 好的做法：缓存解析结果
const parsedContent = useMemo(
  () => parseMessage(content),
  [content]
);

// ❌ 避免：在渲染中重复计算
const parsedContent = parseMessage(content);
```

#### useCallback - 优化回调函数

```typescript
// ✅ 好的做法：缓存回调函数
const handleCopy = useCallback(
  async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
  },
  []
);

// ❌ 避免：每次渲染创建新函数
const handleCopy = async (code: string) => {
  await navigator.clipboard.writeText(code);
  setCopiedCode(code);
};
```

#### React.memo - 避免不必要的重渲染

```typescript
// ✅ 好的做法：使用 React.memo
const CodeBlock = React.memo(({ code, language }) => {
  return <div>{code}</div>;
});

// ❌ 避免：大组件不优化
const CodeBlock = ({ code, language }) => {
  return <div>{code}</div>;
};
```

### 1.2 虚拟列表优化

```typescript
import { FixedSizeList } from 'react-window';

// ✅ 好的做法：虚拟滚动
<FixedSizeList
  height={containerHeight}
  itemCount={messages.length}
  itemSize={MessageItemHeight}
  width="100%"
>
  {({ index, style }) => (
    <div style={style}>
      <MessageItem message={messages[index]} />
    </div>
  )}
</FixedSizeList>
```

---

## 2. 流式内容优化

### 2.1 内容节流

```typescript
const THROTTLE_MS = 60; // 60ms 节流

const throttledUpdate = useMemo(
  () => throttle((content: string) => {
    setContent(content);
  }, THROTTLE_MS),
  []
);

// ✅ 好的做法：增量更新
contentRef.current += newContent;
throttledUpdate(contentRef.current);
```

### 2.2 增量渲染

```typescript
// ✅ 好的做法：使用 ref 缓存内容
const contentRef = useRef('');

const appendContent = useCallback((text: string) => {
  contentRef.current += text;
  // 节流更新 UI
  throttledUpdate(contentRef.current);
}, [throttledUpdate]);
```

---

## 3. 滚动性能优化

### 3.1 被动事件监听

```typescript
// ✅ 好的做法：被动事件监听
container.addEventListener('scroll', handleScroll, { passive: true });

// ❌ 避免：阻塞事件监听
container.addEventListener('scroll', handleScroll);
```

### 3.2 滚动阈值检测

```typescript
const SCROLL_THRESHOLD = 100; // 100px

const handleScroll = () => {
  const { scrollTop, scrollHeight, clientHeight } = container;
  const isAtBottom = scrollHeight - scrollTop - clientHeight < SCROLL_THRESHOLD;
  shouldAutoScroll.current = isAtBottom;
};
```

### 3.3 智能自动滚动

```typescript
useEffect(() => {
  if (shouldAutoScroll.current && !isUserScrolling.current) {
    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth',
    });
  }
}, [messages.length]);
```

---

## 4. 内存优化

### 4.1 状态清理

```typescript
// ✅ 好的做法：清理状态
const reset = useCallback(() => {
  setContent('');
  setThinking('');
  setToolCalls([]);
  setIsStreaming(false);
  contentRef.current = '';
  thinkingRef.current = '';
}, []);

// ✅ 好的做法：清理历史记录
const MAX_HISTORY = 50;
setHistory((prev) => prev.slice(-MAX_HISTORY));
```

### 4.2 组件卸载清理

```typescript
useEffect(() => {
  const interval = setInterval(doSomething, 100);

  return () => {
    clearInterval(interval);
  };
}, []);
```

---

## 5. 列表优化

### 5.1 键值优化

```typescript
// ✅ 好的做法：使用稳定的唯一键
{items.map((item) => (
  <MessageItem key={item.id} message={item} />
))}

// ❌ 避免：使用索引作为键
{items.map((item, index) => (
  <MessageItem key={index} message={item} />
))}
```

### 5.2 组件拆分

```typescript
// ✅ 好的做法：小组件独立
const MessageBubble = ({ content }) => (
  <div className="bubble">{content}</div>
);

// ❌ 避免：大组件
const MessageItem = ({ message }) => (
  <div>
    <Avatar />
    <MessageBubble />
    <Timestamp />
    <Actions />
    {/* ... 100+ 行 */}
  </div>
);
```

---

## 6. 网络性能优化

### 6.1 请求节流

```typescript
// ✅ 好的做法：防抖请求
const debouncedSearch = useMemo(
  () => debounce((query: string) => {
    searchAPI(query);
  }, 300),
  []
);
```

### 6.2 请求取消

```typescript
// ✅ 好的做法：取消过期请求
useEffect(() => {
  const controller = new AbortController();

  fetch(url, { signal: controller.signal })
    .then(res => res.json())
    .then(data => setData(data));

  return () => controller.abort();
}, [url]);
```

---

## 7. 动画性能优化

### 7.1 CSS 动画

```css
/* ✅ 好的做法：使用 transform 和 opacity */
@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ❌ 避免：使用布局属性动画 */
@keyframes slideIn {
  from {
    opacity: 0;
    margin-top: 10px;
  }
}
```

### 7.2 will-change 提示

```css
/* ✅ 好的做法：提示浏览器优化 */
.scrolling-element {
  will-change: transform;
  transform: translateZ(0);
}
```

---

## 8. 性能监控

### 8.1 React DevTools Profiler

```typescript
// 记录性能数据
const logPerformance = (id: string, duration: number) => {
  if (duration > 16) { // 超过 16ms (60fps)
    console.warn(`Performance issue: ${id} took ${duration}ms`);
  }
};
```

### 8.2 Lighthouse

- Performance Score > 80
- Time to Interactive < 3s
- First Contentful Paint < 1.8s

---

## 9. 最佳实践总结

### Do's ✅
1. 使用 `useMemo` 缓存计算结果
2. 使用 `useCallback` 优化回调
3. 使用 `React.memo` 减少重渲染
4. 使用虚拟滚动处理大列表
5. 使用被动事件监听
6. 使用内容节流
7. 清理副作用和定时器
8. 使用稳定的键值
9. 拆分大组件
10. 监控性能指标

### Don'ts ❌
1. 不要在渲染中重复计算
2. 不要每次渲染创建新函数
3. 不要忘记清理副作用
4. 不要使用索引作为键
5. 不要创建大而全的组件
6. 不要阻塞主线程
7. 不要忽略性能警告

---

## 10. 性能指标

### 目标
- 🎯 首屏加载 < 2秒
- 🎯 消息渲染 < 16ms (60fps)
- 🎯 滚动帧率 > 55fps
- 🎯 内存占用 < 200MB

### 监控
- Lighthouse Performance Score > 80
- React DevTools Profiler < 50ms per frame
- Chrome DevTools Performance < 60ms per frame

---

## 参考资料

- [React Performance Guide](https://react.dev/learn/managing-state)
- [Virtual List Performance](https://react-window.vercel.app/)
- [CSS Animation Performance](https://developer.mozilla.org/en-US/docs/Web/Performance/CSS_JavaScript_animation_performance)

---

**最后更新**: 2026-03-22
**版本**: 1.0
