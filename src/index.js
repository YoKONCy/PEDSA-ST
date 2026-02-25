/**
 * PEDSA-JS 插件核心入口
 * 
 * 初始化所有组件并处理 SillyTavern 与 Dashboard 之间的通信。
 */

const GraphEngine = require('./core/GraphEngine');
const KeywordMatcher = require('./core/KeywordMatcher');
const DashboardManager = require('./core/DashboardManager');
const TavernIntegration = require('./core/TavernIntegration');

class PEDSA {
    constructor() {
        console.log('[PEDSA] 正在初始化核心系统... 喵~');
        
        // 1. 初始化核心组件
        this.engine = new GraphEngine();
        this.matcher = new KeywordMatcher();
        this.dashboard = new DashboardManager(this.engine, this.matcher);
        this.tavern = new TavernIntegration(this.engine, this.dashboard, this.matcher);
        
        // 2. 绑定仪表盘更新回调
        this.dashboard.onUpdate = (type, data) => {
            this._broadcastSnapshot();
        };

        // 3. 监听配置更新
        this.dashboard.onSettingsUpdate = (settings) => {
            this.tavern.updateSettings(settings);
        };

        // 4. 初始化消息监听 (用于处理 Dashboard 的 postMessage)
        this._initMessageBridge();
        
        // 6. 监听酒馆核心事件喵~
        this._initTavernEvents();

        // 7. 定时推送快照 (保持 UI 活跃)
        setInterval(() => this._broadcastSnapshot(), 5000);

        // 8. 注入顶栏按钮喵~
        this._createTopBarButton();

        console.log('[PEDSA] 系统初始化完成！喵呜~');
    }

    /**
     * 初始化酒馆核心事件
     */
    _initTavernEvents() {
        const tryInit = () => {
            if (typeof window === 'undefined' || !window.SillyTavern) return false;
            
            const context = window.SillyTavern.getContext();
            if (!context || !context.eventSource) return false;

            // 监听聊天切换
            context.eventSource.on('chat_changed', () => {
                console.log('[PEDSA] 检测到聊天切换，正在重置引擎...喵~');
                this.engine = new GraphEngine(); // 简单重置，实际可能需要从缓存加载喵~
                this.tavern.engine = this.engine;
                this.dashboard.engine = this.engine;
                this._broadcastSnapshot();
            });

            return true;
        };

        if (!tryInit()) {
            const interval = setInterval(() => {
                if (tryInit()) clearInterval(interval);
            }, 2000);
        }
    }

    /**
     * 创建顶栏按钮入口（模仿 Engram 的 drawer 结构）
     * 参考 Engram-master/src/integrations/tavern/bridge.ts 中的 createTopBarButton
     */
    _createTopBarButton() {
        if (typeof document === 'undefined') return;

        const holder = document.querySelector('#top-settings-holder');
        const wiButton = document.querySelector('#WI-SP-button');

        if (!holder) {
            // DOM 还没加载好，延迟重试喵~
            setTimeout(() => this._createTopBarButton(), 1000);
            return;
        }

        // 如果已经存在就不重复注入
        if (document.getElementById('pedsa-drawer')) {
            console.log('[PEDSA] 顶栏按钮已存在，跳过注入');
            return;
        }

        // 创建 drawer 容器（模仿酒馆结构）
        const drawer = document.createElement('div');
        drawer.id = 'pedsa-drawer';
        drawer.className = 'drawer';

        // drawer-toggle 包装器
        const toggle = document.createElement('div');
        toggle.className = 'drawer-toggle drawer-header';

        // drawer-icon 图标
        const icon = document.createElement('div');
        icon.id = 'pedsa-drawer-icon';
        icon.className = 'drawer-icon fa-solid fa-brain fa-fw closedIcon';
        icon.title = 'PEDSA - 记忆拓扑操作系统';
        icon.setAttribute('data-i18n', '[title]PEDSA - Memory Topology');

        // 点击切换面板
        icon.addEventListener('click', () => this.toggleDashboard());

        // 组装结构
        toggle.appendChild(icon);
        drawer.appendChild(toggle);

        // 插入到 WI-SP-button 之前，如果找不到则添加到末尾
        if (wiButton) {
            holder.insertBefore(drawer, wiButton);
        } else {
            holder.appendChild(drawer);
        }

        console.log('[PEDSA] 顶栏按钮注入成功！喵~');
    }

    /**
     * 切换仪表盘显示状态
     */
    toggleDashboard() {
        let overlay = document.getElementById('pedsa-overlay');
        
        if (overlay) {
            overlay.classList.toggle('hidden');
            if (!overlay.classList.contains('hidden')) {
                this._broadcastSnapshot();
            }
        } else {
            this._createDashboardOverlay();
        }
    }

    /**
     * 创建仪表盘遮罩层与 iframe
     */
    _createDashboardOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'pedsa-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(8px);
            z-index: 9999;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        overlay.onclick = (e) => {
            if (e.target === overlay) {
                overlay.classList.add('hidden');
            }
        };

        const container = document.createElement('div');
        container.style.cssText = `
            width: 90vw;
            height: 90vh;
            background: #0f172a;
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 24px;
            overflow: hidden;
            position: relative;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        `;

        const closeBtn = document.createElement('div');
        closeBtn.innerHTML = '×';
        closeBtn.style.cssText = `
            position: absolute;
            top: 20px;
            right: 20px;
            width: 40px;
            height: 40px;
            background: rgba(255, 255, 255, 0.1);
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            font-size: 24px;
            z-index: 10;
            transition: all 0.3s;
        `;
        closeBtn.onclick = () => overlay.classList.add('hidden');
        closeBtn.onmouseenter = () => closeBtn.style.background = 'rgba(255, 255, 255, 0.2)';
        closeBtn.onmouseleave = () => closeBtn.style.background = 'rgba(255, 255, 255, 0.1)';

        const iframe = document.createElement('iframe');
        this.dashboardIframe = iframe; // 记录 iframe 引用喵~

        // 尝试通过 manifest 获取准确的扩展路径喵~
        const scriptPath = document.currentScript ? document.currentScript.src : '';
        let basePath = '/extensions/PEDSA-JS/';
        if (scriptPath.includes('/extensions/')) {
            basePath = scriptPath.substring(0, scriptPath.indexOf('/src/index.js') + 1);
        }

        iframe.src = basePath + 'src/ui/dashboard.html';
        iframe.style.cssText = `
            width: 100%;
            height: 100%;
            border: none;
        `;

        container.appendChild(closeBtn);
        container.appendChild(iframe);
        overlay.appendChild(container);
        document.body.appendChild(overlay);

        // 首次加载后发送快照
        iframe.onload = () => this._broadcastSnapshot();
    }

    /**
     * 初始化消息桥接
     */
    _initMessageBridge() {
        window.addEventListener('message', (event) => {
            const { type, payload } = event.data;
            
            if (type === 'SAVE_SETTINGS') {
                console.log('[PEDSA] 收到配置保存请求:', payload);
                this.dashboard.saveSettings(payload);
            }
            
            if (type === 'REQUEST_SNAPSHOT') {
                this._broadcastSnapshot();
            }
        });
    }

    /**
     * 广播当前状态快照到仪表盘
     */
    _broadcastSnapshot() {
        const snapshot = this.dashboard.getSnapshot();
        
        // 优先发送给记录的 iframe 喵~
        if (this.dashboardIframe && this.dashboardIframe.contentWindow) {
            try {
                this.dashboardIframe.contentWindow.postMessage({
                    type: 'UPDATE_SNAPSHOT',
                    payload: snapshot
                }, '*');
                return; // 发送成功就直接返回喵~
            } catch (e) {
                console.warn('[PEDSA] 无法向主 iframe 发送消息:', e);
            }
        }

        // 备选方案：如果 iframe 引用丢失，尝试搜索所有 iframe (兼容性兜底)
        const iframes = document.querySelectorAll('iframe');
        iframes.forEach(iframe => {
            try {
                if (iframe.contentWindow) {
                    iframe.contentWindow.postMessage({
                        type: 'UPDATE_SNAPSHOT',
                        payload: snapshot
                    }, '*');
                }
            } catch (e) {}
        });
    }
}

/**
 * 初始化 PEDSA 插件
 */
function initializePEDSA() {
    console.log('[PEDSA] 开始初始化插件... 喵~');
    
    // 创建全局单例
    if (typeof window !== 'undefined' && !window.pedsa) {
        window.pedsa = new PEDSA();
    }
}

// 等待 DOM 加载完成后初始化（模仿 Engram 的初始化方式）
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializePEDSA);
    } else {
        // DOM 已经加载完成，直接初始化
        initializePEDSA();
    }
}

module.exports = PEDSA;
