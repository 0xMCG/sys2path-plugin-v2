# 数据采集流程文档

## 概述

本文档详细说明数据采集的完整流程，包括触发机制、数据采集逻辑、存储位置和格式、版本控制和跨页面同步。

## 1. 触发机制

### 1.1 用户操作

- **触发点**: 用户点击右下角的"保存悬浮框"按钮
- **位置**: 页面右下角，固定位置（FAB按钮）
- **行为**: 
  - 点击后触发数据采集
  - 显示采集状态（idle → fetching → success/failure）
  - 如果侧边栏未打开，则自动打开侧边栏
  - 如果侧边栏已打开，则保持打开状态（不会关闭）

### 1.2 代码位置

- **文件**: `src/content/content.ts`
- **函数**: `initializeUI()` → `injectOverlayWidget()`
- **回调**: 点击悬浮按钮时调用 `handleCapture()`

```typescript
injectOverlayWidget(() => {
  console.log('[CONTENT] Overlay widget clicked - capturing data');
  handleCapture();
  // Sidebar will be opened if not already open
}, false);
```

## 2. 数据采集逻辑

### 2.1 平台检测

**文件**: `src/content/content.ts` → `initCapture()`

系统首先检测当前页面是否为 ChatLLM 平台：

```typescript
const platform = PlatformDetector.detectPlatform();
```

**支持的平台**:
- ChatGPT (`chatgpt.com`, `chat.openai.com`)
- Claude (`claude.ai`)
- Gemini (`gemini.google.com`)
- NoteBookLM (`notebooklm.google.com`)
- AI Studio (`aistudio.google.com`)
- Grok (`grok.com`, `x.com/i/grok*`)

**检测逻辑**:
- 通过 URL hostname 匹配
- 提取会话 ID（session ID）用于标识对话
- DOM 基础平台（Gemini, NoteBookLM, AI Studio）的 session ID 可选，如果未找到会自动生成

### 2.2 采集模式

根据平台类型，系统采用两种不同的采集模式：

#### 模式 1: ChatLLM 平台采集（API 基础）

**文件**: `src/content/capture/chatllm.ts` + `src/content/capture/api-helpers.ts`

**支持的平台**: ChatGPT, Claude, Grok

**采集方法**:
- **API 拦截**: 拦截平台的 API 调用
  - ChatGPT: 拦截 `/backend-api/conversation/{id}` 的 fetch 调用
  - Claude: 拦截 `/api/organizations/{orgId}/chat_conversations/{id}` 的 fetch 调用
  - Grok: 拦截 `/api/grok/conversations/{id}` 的 fetch 调用
- **Token 获取**: 从 localStorage 获取访问令牌（ChatGPT）或用户 ID（Claude）
- **数据获取**: 通过 API 获取完整对话数据
- **数据转换**: 将 API 响应转换为 `ChatLLMConversation` 格式

**特殊处理**:
- **ChatGPT**: 
  - 过滤工具调用（tool calls）
  - 解码 Unicode 转义序列（如 `\u5e74` → `年`）
- **Grok**: 
  - 处理 `<grok:render>` 标签
  - 如果有引用数据，转换为 Markdown 链接
  - 否则移除标签

#### 模式 2: ChatLLM 平台采集（DOM 基础）

**文件**: `src/content/capture/chatllm.ts`

**支持的平台**: Gemini, NoteBookLM, AI Studio

**采集方法**:
- **DOM 解析**: 使用平台特定的选择器提取消息
  - Gemini: `[data-message-type]`, `.model-response-text`
  - NoteBookLM: `.message`, `[role="article"]`
  - AI Studio: `[data-message-type]`, `.model-response-text`
- **角色识别**: 通过 DOM 属性识别用户和 AI 消息
- **时间戳生成**: 为每条消息生成时间戳
- **标题提取**: 从第一条消息提取标题（12 个汉字或 5 个英文单词，混合语言按单位计算）

**特殊处理**:
- 修复 NotebookLM 的 "undefined" 问题（确保 textContent 不为 undefined）
- 自动生成 session ID（如果 URL 中未找到）

#### 模式 3: 普通页面采集

**文件**: `src/content/capture/general.ts`

**采集内容**:
- 页面标题（Title）
- 主要内容文本（Content，已去除 HTML 标签）
- 页面 URL（url）
- 捕获时间（capturedAt）

**采集方法**:
1. 查找主要内容区域（按优先级）:
   - `<main>`
   - `<article>`
   - `[role="main"]`
   - `.main-content`, `.content`, `#content`, `#main`
   - `.post-content`, `.entry-content`
   - 如果都找不到，使用 `<body>`

2. 清理内容:
   - 移除 `<script>`, `<style>`, `<noscript>`, `<iframe>` 等
   - 移除导航、页眉、页脚、侧边栏等非内容元素
   - 提取纯文本（自动去除 HTML 标签）
   - 清理空白字符

### 2.3 标题提取

**文件**: `src/content/capture/chatllm.ts` → `extractTitleFromFirstMessage()`

**规则**:
- **纯中文**: 提取前 12 个汉字 + "..."
- **纯英文**: 提取前 5 个单词 + "..."
- **混合语言**: 12 个单位（1 个汉字 = 1 单位，1 个英文单词 = 2 单位）+ "..."
- **其他语言**: 提取前 12 个字符 + "..."

**后缀**: 如果标题被截断（不是 "Untitled Conversation"），自动添加 "..." 后缀

### 2.4 采集执行流程

**文件**: `src/content/content.ts` → `handleCapture()`

```typescript
async function handleCapture(): Promise<void> {
  console.log('[CONTENT] Capture triggered by user');
  
  let capturedData: ChatLLMConversation | GeneralPageContent | null = null;
  
  // 根据平台类型选择采集器
  if (chatLLMCapture) {
    capturedData = await chatLLMCapture.capture();
  } else if (generalCapture) {
    capturedData = await generalCapture.capture();
  }
  
  // 采集成功后，数据已通过消息传递保存到后台
  // 通知侧边栏刷新数据
  if (capturedData) {
    const iframe = document.getElementById('sys2path-sidebar-iframe');
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({
        type: 'DATA_CAPTURED',
        data: capturedData
      }, '*');
    }
  }
}
```

## 3. 数据存储

### 3.1 存储位置

**存储方式**: Chrome Extension Local Storage (`chrome.storage.local`)

**存储键名**:
- 对话数据: `sys2path_conversations` (数组)
- 页面内容: `sys2path_page_contents` (数组)
- 版本标签: `sys2path_version_tags` (对象，映射 versionId → tag)

### 3.2 消息传递机制

**重要**: Content Script 在某些上下文中无法直接访问 `chrome.storage.local`，因此所有存储操作都通过消息传递：

**Content Script → Background Script**:
```typescript
// 在 content script 中
chrome.runtime.sendMessage({
  type: 'SAVE_CONVERSATION',
  data: conversation
}, (response) => {
  if (response?.success) {
    console.log('保存成功');
  }
});
```

**Background Script → Storage Service**:
```typescript
// 在 background script 中
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SAVE_CONVERSATION') {
    StorageService.saveConversation(message.data)
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // 保持通道开放以等待异步响应
  }
});
```

### 3.3 存储服务

**文件**: `src/services/storage.ts`

**主要方法**:
- `StorageService.saveConversation(conversation)` - 保存对话（创建新版本）
- `StorageService.savePageContent(content)` - 保存页面内容（创建新版本）
- `StorageService.getAllConversations()` - 获取所有对话版本
- `StorageService.getAllPageContents()` - 获取所有页面内容版本
- `StorageService.deleteConversationVersion(versionId)` - 删除单个对话版本
- `StorageService.deletePageContentVersion(versionId)` - 删除单个页面内容版本
- `StorageService.deleteConversationsByBaseId(baseId)` - 删除所有对话版本
- `StorageService.deletePageContentsByBaseId(baseId)` - 删除所有页面内容版本
- `StorageService.deleteDataSources(baseIds)` - 批量删除数据源
- `StorageService.updateVersionTag(versionId, tag)` - 更新版本标签
- `StorageService.getVersionTag(versionId)` - 获取版本标签

### 3.4 版本控制

**ID 格式**: `{baseId}-{timestamp}`

- `baseId`: 原始会话/对话 ID 或 URL 哈希
- `timestamp`: 捕获时间戳（毫秒）

**版本创建逻辑**:
```typescript
// 每次保存都创建新版本
const baseId = conversation.id.split('-').slice(0, -1).join('-') || conversation.id;
const timestamp = conversation.capturedAt;
const versionedId = `${baseId}-${timestamp}`;

// 创建带版本 ID 的新条目
const versionedConversation: ChatLLMConversation = {
  ...conversation,
  id: versionedId
};

// 总是添加为新条目（版本控制）
conversations.push(versionedConversation);
```

**版本分组**: 在 UI 中，通过 `baseId` 将版本分组显示

### 3.5 数据格式

**ChatLLM 对话格式**:
```typescript
interface ChatLLMConversation {
  id: string;                    // 版本化 ID: {baseId}-{timestamp}
  platform: ChatLLMPlatform;     // 平台类型
  title: string;                 // 对话标题（如果截断，带 "..." 后缀）
  messages: ChatLLMMessage[];    // 消息列表
  capturedAt: number;            // 捕获时间戳
  url: string;                   // 页面 URL
}

interface ChatLLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;               // 消息内容（可能包含 Markdown）
  timestamp: number;              // 消息时间戳
}
```

**普通页面格式**:
```typescript
interface GeneralPageContent {
  id: string;                    // 版本化 ID: {baseId}-{timestamp}
  url: string;                   // 页面 URL
  title: string;                 // 页面标题
  content: string;               // 纯文本内容（已去除 HTML）
  capturedAt: number;            // 捕获时间戳
}
```

## 4. 数据加载与显示

### 4.1 数据加载服务

**文件**: `src/services/data-loader.ts`

**主要功能**:
- 从 `chrome.storage.local` 加载所有数据
- 将存储的数据转换为 `DataSource` 格式
- 按 `baseId` 分组版本
- 加载版本标签

**转换逻辑**:
```typescript
// 将多个对话版本转换为单个 DataSource
export function convertConversationsToDataSource(
  conversations: ChatLLMConversation[],
  versionTags?: Record<string, string>
): DataSource | null {
  // 按捕获时间排序（最新的在前）
  const sorted = [...conversations].sort((a, b) => b.capturedAt - a.capturedAt);
  const latest = sorted[0];
  const baseId = getBaseId(latest.id);
  
  // 转换为版本列表
  const versions: SourceVersion[] = sorted.map(conv => ({
    id: conv.id,
    timestamp: formatTimestamp(conv.capturedAt),
    changeSummary: `Captured ${conv.messages.length} messages`,
    status: 'local',
    tag: versionTags?.[conv.id]
  }));
  
  // 创建 DataSource
  return {
    id: baseId,
    title: latest.title,
    url: latest.url,
    platform: latest.platform,
    // ... 其他属性
    currentVersionId: latest.id,
    versions
  };
}
```

### 4.2 侧边栏数据刷新

**文件**: `src/sidebar/components/Workbench.tsx`

**刷新机制**:
1. **初始加载**: 组件挂载时调用 `loadDataSources()`
2. **存储变化监听**: 监听 `chrome.storage.onChanged` 事件
3. **消息监听**: 监听 `DATA_CAPTURED` 消息事件

```typescript
useEffect(() => {
  refreshDataSources();

  // 监听存储变化（跨页面同步）
  const handleStorageChange = (
    changes: Record<string, chrome.storage.StorageChange>,
    namespace: string
  ) => {
    if (namespace === 'local') {
      console.log('[WORKBENCH] Storage changed, refreshing...');
      refreshDataSources();
    }
  };

  chrome.storage.onChanged.addListener(handleStorageChange);

  // 监听数据采集消息
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'DATA_CAPTURED') {
      console.log('[WORKBENCH] Data captured, refreshing...');
      refreshDataSources();
    }
  });

  return () => {
    chrome.storage.onChanged.removeListener(handleStorageChange);
    window.removeEventListener('message', () => {});
  };
}, [refreshDataSources]);
```

## 5. 跨页面同步

### 5.1 同步机制

**原理**: 使用 `chrome.storage.onChanged` 事件监听存储变化

**实现**:
1. 用户在页面 A 保存数据
2. Background Script 保存数据到 `chrome.storage.local`
3. Chrome 触发 `chrome.storage.onChanged` 事件
4. 所有打开的页面（包括页面 B）的侧边栏监听器接收到事件
5. 侧边栏自动刷新数据源列表

**代码位置**: `src/sidebar/components/Workbench.tsx`

```typescript
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    // 检查相关键是否变化
    if (changes.sys2path_conversations || changes.sys2path_page_contents) {
      refreshDataSources();
    }
  }
});
```

### 5.2 同步范围

- **同步的数据**: 所有对话和页面内容
- **同步的页面**: 所有打开扩展的页面
- **同步的延迟**: 几乎实时（Chrome 事件传播）

## 6. 数据管理功能

### 6.1 版本选择

- 每个数据源显示版本下拉菜单
- 选择不同版本可查看历史数据
- 版本显示格式: `v{N} - {timestamp} [tag]`

### 6.2 版本标签

- 点击标签按钮为当前版本添加标签
- 标签保存在 `sys2path_version_tags` 存储键中
- 标签显示在版本下拉菜单中

### 6.3 删除功能

- **删除单个版本**: 删除当前选中的版本
- **删除所有版本**: 删除该数据源的所有版本
- **批量删除**: 选择多个数据源后批量删除

### 6.4 数据预览

- 点击数据源可预览内容
- 支持 ChatLLM 对话和普通页面内容的预览
- 对话预览显示消息列表（支持 Markdown）
- 普通页面内容显示纯文本

## 7. 数据流程总结

```
用户点击保存按钮
    ↓
Content Script: handleCapture()
    ↓
检测平台类型
    ↓
选择采集器（ChatLLM / General）
    ↓
执行采集（API 拦截 / DOM 解析）
    ↓
转换数据格式
    ↓
提取标题（ChatLLM 平台）
    ↓
生成版本化 ID ({baseId}-{timestamp})
    ↓
发送消息到 Background Script (SAVE_CONVERSATION / SAVE_PAGE_CONTENT)
    ↓
Background Script: StorageService.saveXXX()
    ↓
保存到 chrome.storage.local
    ↓
触发 chrome.storage.onChanged 事件
    ↓
所有页面的侧边栏监听器接收事件
    ↓
刷新数据源列表
    ↓
UI 更新显示新数据
```

## 8. 参考实现

数据采集实现参考了 `examples/lyra_exporter_fetch.js`，包括：
- 平台特定的提取逻辑
- 消息角色识别
- 时间戳处理
- 对话结构
- 标题提取方法
- 引用处理（Grok）
