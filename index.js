/**
 * PEDSA-JS 插件核心入口 (Bundle Version)
 * 
 * 为了解决浏览器环境不支持 CommonJS require 的问题，
 * 我们将所有核心模块打包到了这个单一文件中。
 * 
 * 包含模块：
 * 1. SimHash
 * 2. Stopwords
 * 3. AhoCorasick
 * 4. KeywordMatcher
 * 5. GraphEngine
 * 6. OntologyManager
 * 7. QueryGenerator
 * 8. DashboardManager
 * 9. TavernIntegration
 * 10. PEDSA Main
 */

(function() {
    // 检查是否已经在 iframe 中运行，防止套娃喵~
    const isInIframe = window.self !== window.top;
    
    // 增加调试日志，帮主人看清现在的环境喵~
    console.log('[PEDSA] 脚本运行环境检查:', {
        isInIframe,
        href: window.location.href,
        pathname: window.location.pathname
    });

    if (isInIframe) {
        // 如果是在 iframe 中，通常是因为 dashboard.html 加载了 index.js 或者路径错误加载了主页面
        // 我们绝对不能在这里初始化插件逻辑，否则会无限递归喵！
        console.warn('[PEDSA] 检测到处于 iframe 环境，停止初始化以防止套娃喵~');
        return;
    }

    console.log('====================================');
    console.log('🐈 [PEDSA] 核心脚本加载成功！(Bundled)');
    console.log('====================================');

    // 路径识别逻辑优化喵~
    const getBasePath = () => {
        // 1. 优先尝试从错误堆栈中提取路径（这在某些加载器下更可靠喵~）
        try {
            const err = new Error();
            const stack = err.stack;
            if (stack) {
                const matches = stack.match(/((?:https?|file):\/\/[^/]+\/[^:]+\/)/);
                if (matches && matches[1] && matches[1].includes('extensions')) {
                    const path = matches[1];
                    console.log('[PEDSA] 通过堆栈追踪识别路径:', path);
                    return path;
                }
            }
        } catch (e) {}

        // 2. 尝试使用 currentScript
        if (document.currentScript && document.currentScript.src) {
            const src = document.currentScript.src;
            const path = src.substring(0, src.lastIndexOf('/') + 1);
            console.log('[PEDSA] 通过 currentScript 识别路径:', path);
            return path;
        }

        // 3. 扫描所有 script 标签
        const scripts = document.getElementsByTagName('script');
        for (let i = scripts.length - 1; i >= 0; i--) {
            const src = scripts[i].src;
            if (src && (src.includes('PEDSA') || src.includes('index.js')) && src.includes('/extensions/')) {
                const path = src.substring(0, src.lastIndexOf('/') + 1);
                console.log('[PEDSA] 通过扫描 script 标签识别路径:', path);
                return path;
            }
        }

        // 4. 如果是在 SillyTavern 环境，通常可以通过这种方式推断喵~
        if (window.location.pathname.includes('/')) {
            const stPath = '/extensions/PEDSA-JS/';
            console.log('[PEDSA] 使用标准扩展路径推断:', stPath);
            return stPath;
        }

        console.warn('[PEDSA] 路径识别失败，使用保底路径喵~');
        return '/extensions/PEDSA-JS/';
    };

    const globalBasePath = getBasePath();
    console.log('[PEDSA] 最终确定的根目录:', globalBasePath);

    /**
     * PEDSA UI 管理器 - 负责全屏界面的注入与逻辑
     * 采用单页注入模式，不使用 iframe 以彻底解决套娃问题喵！
     */
    class PEDSAUI {
        constructor(pedsa) {
            this.pedsa = pedsa;
            this.overlay = null;
            this.graph = null;
            this.activeView = 'dashboard';
            this.isInitialized = false;
            this.depsLoaded = false;
        }

        /**
         * 加载必要的外部依赖库喵~
         */
        async loadDependencies() {
            if (this.depsLoaded) return;

            const deps = [
                { type: 'script', id: 'tailwind-cdn', src: 'https://cdn.tailwindcss.com' },
                { type: 'script', id: 'lucide-cdn', src: 'https://unpkg.com/lucide@latest' },
                { type: 'script', id: 'force-graph-cdn', src: 'https://unpkg.com/force-graph' }
            ];

            const loadPromises = deps.map(dep => {
                if (document.getElementById(dep.id)) return Promise.resolve();
                return new Promise((resolve, reject) => {
                    const el = document.createElement(dep.type);
                    el.id = dep.id;
                    if (dep.type === 'script') {
                        el.src = dep.src;
                    } else {
                        el.rel = 'stylesheet';
                        el.href = dep.src;
                    }
                    el.onload = resolve;
                    el.onerror = reject;
                    document.head.appendChild(el);
                });
            });

            try {
                await Promise.all(loadPromises);
                console.log('[PEDSA] UI 依赖库加载完成喵！');
                this.depsLoaded = true;
            } catch (e) {
                console.error('[PEDSA] UI 依赖加载失败:', e);
            }
        }

        /**
         * 注入 CSS 样式喵~
         */
        injectStyles() {
            if (document.getElementById('pedsa-ui-styles')) return;
            const style = document.createElement('style');
            style.id = 'pedsa-ui-styles';
            style.innerHTML = `
                @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Noto+Sans+SC:wght@300;400;500;700&display=swap');
                
                #pedsa-overlay {
                    --sky-accent: #38bdf8;
                    --sky-glow: 0 0 20px rgba(56, 189, 248, 0.3);
                    --energy-accent: #7dd3fc;
                    font-family: 'Noto Sans SC', sans-serif;
                }

                #pedsa-overlay .mono { font-family: 'JetBrains Mono', monospace; }

                /* 毛玻璃效果 */
                #pedsa-overlay .glass {
                    background: rgba(255, 255, 255, 0.03);
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
                }

                #pedsa-overlay .glass-dark {
                    background: rgba(0, 0, 0, 0.2);
                    backdrop-filter: blur(16px);
                    -webkit-backdrop-filter: blur(16px);
                    border: 1px solid rgba(255, 255, 255, 0.05);
                }

                /* 视图切换辅助类 */
                #pedsa-overlay .view-section { transition: opacity 0.3s ease, transform 0.3s ease; }
                #pedsa-overlay .view-section.hidden { display: none; opacity: 0; transform: translateY(10px); }
                #pedsa-overlay .view-section.active { display: block; opacity: 1; transform: translateY(0); }

                /* 导航项样式优化 */
                #pedsa-overlay .nav-item {
                    cursor: pointer;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }

                #pedsa-overlay .nav-item.active-desktop {
                    background: rgba(56, 189, 248, 0.1);
                    color: #7dd3fc;
                    border-color: rgba(56, 189, 248, 0.2);
                    box-shadow: inset 0 0 10px rgba(56, 189, 248, 0.1);
                }

                /* 响应式滚动条 */
                #pedsa-overlay ::-webkit-scrollbar { width: 4px; }
                #pedsa-overlay ::-webkit-scrollbar-track { background: transparent; }
                #pedsa-overlay ::-webkit-scrollbar-thumb { background: rgba(56, 189, 248, 0.3); border-radius: 10px; }

                @keyframes pedsa-pulse {
                    0% { opacity: 0.4; transform: scale(1); }
                    50% { opacity: 0.8; transform: scale(1.02); }
                    100% { opacity: 0.4; transform: scale(1); }
                }
                #pedsa-overlay .energy-pulse { animation: pedsa-pulse 3s infinite ease-in-out; }

                #pedsa-overlay .text-gradient {
                    background: linear-gradient(to right, #7dd3fc, #38bdf8, #0ea5e9);
                    -webkit-background-clip: text;
                    background-clip: text;
                    -webkit-text-fill-color: transparent;
                }
            `;
            document.head.appendChild(style);
        }

        /**
         * 渲染主界面喵~
         */
        async render() {
            await this.loadDependencies();
            this.injectStyles();

            if (this.overlay) {
                this.overlay.classList.remove('hidden');
                this.updateUI();
                return;
            }

            const overlay = document.createElement('div');
            overlay.id = 'pedsa-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: radial-gradient(circle at top right, #0c4a6e, #082f49, #020617);
                color: #f0f9ff;
                z-index: 99999;
                display: flex;
                flex-direction: row;
                overflow: hidden;
            `;

            // HTML 模板注入
            overlay.innerHTML = `
                <!-- 侧边栏导航 -->
                <aside class="w-72 h-full glass-dark border-r border-white/5 flex flex-col z-20 sidebar">
                    <div class="p-8">
                        <div class="flex items-center gap-3 mb-2">
                            <div class="w-10 h-10 rounded-2xl bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center shadow-[0_0_20px_rgba(56,189,248,0.4)] energy-pulse">
                                <i data-lucide="brain-circuit" class="text-white w-6 h-6"></i>
                            </div>
                            <h1 class="text-2xl font-black tracking-tighter text-white">PEDSA <span class="text-sky-400">JS</span></h1>
                        </div>
                        <p class="text-[10px] font-bold text-sky-400/50 uppercase tracking-[0.2em] ml-1">Memory Topology OS</p>
                    </div>

                    <nav class="flex-1 px-4 space-y-2">
                        <div data-view="dashboard" class="nav-item active-desktop flex items-center gap-4 px-5 py-4 rounded-2xl border border-transparent">
                            <i data-lucide="layout-dashboard" class="w-5 h-5"></i>
                            <span class="font-medium">系统概览</span>
                        </div>
                        <div data-view="network" class="nav-item text-sky-100/50 hover:bg-white/5 hover:text-sky-200 flex items-center gap-4 px-5 py-4 rounded-2xl border border-transparent">
                            <i data-lucide="share-2" class="w-5 h-5"></i>
                            <span class="font-medium">拓扑图谱</span>
                        </div>
                        <div data-view="events" class="nav-item text-sky-100/50 hover:bg-white/5 hover:text-sky-200 flex items-center gap-4 px-5 py-4 rounded-2xl border border-transparent">
                            <i data-lucide="activity" class="w-5 h-5"></i>
                            <span class="font-medium">事件流</span>
                        </div>
                        <div data-view="settings" class="nav-item text-sky-100/50 hover:bg-white/5 hover:text-sky-200 flex items-center gap-4 px-5 py-4 rounded-2xl border border-transparent">
                            <i data-lucide="settings-2" class="w-5 h-5"></i>
                            <span class="font-medium">内核配置</span>
                        </div>
                    </nav>

                    <div class="p-6">
                        <div class="glass rounded-2xl p-4 border-sky-400/10">
                            <div class="flex items-center gap-2 mb-3">
                                <div class="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.5)]"></div>
                                <span class="text-[10px] font-bold text-sky-100/40 uppercase tracking-widest">Core Status: Active</span>
                            </div>
                            <button id="pedsa-close-btn" class="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold transition-all border border-white/5">
                                返回酒馆
                            </button>
                        </div>
                    </div>
                </aside>

                <!-- 主内容区域 -->
                <main class="flex-1 h-full relative flex flex-col overflow-hidden main-content">
                    <!-- 顶部状态栏 -->
                    <header class="h-20 px-10 flex items-center justify-between z-10">
                        <div class="flex items-center gap-4">
                            <div class="h-8 w-[1px] bg-white/10"></div>
                            <div id="breadcrumb" class="text-sm text-sky-100/40 font-medium">System / <span class="text-sky-100">Dashboard</span></div>
                        </div>
                        <div class="flex items-center gap-6">
                            <div class="flex flex-col items-end">
                                <span class="text-[10px] font-bold text-sky-400/50 uppercase">Active Nodes</span>
                                <span class="text-lg font-black text-white mono" id="stat-nodes-count">0</span>
                            </div>
                            <button id="pedsa-refresh-btn" class="w-12 h-12 glass rounded-2xl flex items-center justify-center hover:bg-sky-500/10 hover:border-sky-500/30 transition-all">
                                <i data-lucide="refresh-cw" class="w-5 h-5 text-sky-400"></i>
                            </button>
                        </div>
                    </header>

                    <div class="flex-1 overflow-y-auto px-10 pb-10 custom-scrollbar">
                        <!-- 概览视图 -->
                        <section id="content-dashboard" class="view-section active space-y-8">
                            <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                <div class="lg:col-span-2 glass rounded-[2.5rem] p-10 border-sky-400/10 relative overflow-hidden group">
                                    <div class="absolute -right-20 -top-20 w-80 h-80 bg-sky-500/10 rounded-full blur-[100px] group-hover:bg-sky-500/20 transition-all duration-700"></div>
                                    <h3 class="text-4xl font-black mb-2 text-white tracking-tighter">记忆扩散指纹</h3>
                                    <p class="text-sky-400/60 mb-8 font-medium">当前活跃状态的四维向量共鸣分析</p>
                                    
                                    <div class="grid grid-cols-2 gap-10 mt-10">
                                        <div class="space-y-4">
                                            <div class="flex justify-between text-[11px] font-bold uppercase tracking-wider text-sky-400/70">
                                                <span>Semantic 语义</span>
                                                <span class="text-sky-300" id="text-semantic">0%</span>
                                            </div>
                                            <div class="h-2.5 bg-white/5 rounded-full overflow-hidden border border-white/5 p-0.5" id="bar-semantic">
                                                <div class="h-full bg-gradient-to-r from-sky-600 to-sky-400 rounded-full w-[0%] transition-all duration-500"></div>
                                            </div>
                                        </div>
                                        <div class="space-y-4">
                                            <div class="flex justify-between text-[11px] font-bold uppercase tracking-wider text-sky-400/70">
                                                <span>Temporal 时间</span>
                                                <span class="text-sky-300" id="text-temporal">0%</span>
                                            </div>
                                            <div class="h-2.5 bg-white/5 rounded-full overflow-hidden border border-white/5 p-0.5" id="bar-temporal">
                                                <div class="h-full bg-gradient-to-r from-sky-500 to-sky-300 rounded-full w-[0%] transition-all duration-500"></div>
                                            </div>
                                        </div>
                                        <div class="space-y-4">
                                            <div class="flex justify-between text-[11px] font-bold uppercase tracking-wider text-sky-400/70">
                                                <span>Affective 情感</span>
                                                <span class="text-sky-300" id="text-affective">0%</span>
                                            </div>
                                            <div class="h-2.5 bg-white/5 rounded-full overflow-hidden border border-white/5 p-0.5" id="bar-affective">
                                                <div class="h-full bg-gradient-to-r from-pink-500 to-pink-300 rounded-full w-[0%] transition-all duration-500"></div>
                                            </div>
                                        </div>
                                        <div class="space-y-4">
                                            <div class="flex justify-between text-[11px] font-bold uppercase tracking-wider text-sky-400/70">
                                                <span>Entity 实体</span>
                                                <span class="text-sky-300" id="text-entity">0%</span>
                                            </div>
                                            <div class="h-2.5 bg-white/5 rounded-full overflow-hidden border border-white/5 p-0.5" id="bar-entity">
                                                <div class="h-full bg-gradient-to-r from-sky-400 to-sky-200 rounded-full w-[0%] transition-all duration-500"></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div class="glass rounded-[2.5rem] p-8 border-sky-400/10 flex flex-col">
                                    <h4 class="text-xl font-bold mb-6 flex items-center gap-3 text-white">
                                        <i data-lucide="terminal" class="w-5 h-5 text-sky-400"></i>
                                        内核运行日志
                                    </h4>
                                    <div id="log-container" class="flex-1 space-y-3 mono text-[11px] overflow-y-auto pr-2 custom-scrollbar">
                                        <!-- 日志项 -->
                                    </div>
                                </div>
                            </div>

                            <div class="glass rounded-[2.5rem] p-10 border-sky-400/10">
                                <h3 class="text-2xl font-bold mb-8 flex items-center gap-3 text-white">
                                    <i data-lucide="history" class="w-6 h-6 text-sky-400"></i>
                                    最新记忆事件
                                </h3>
                                <div id="event-list-container" class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <!-- 事件卡片 -->
                                </div>
                            </div>
                        </section>

                        <!-- 图谱视图 -->
                        <section id="content-network" class="view-section hidden h-[calc(100vh-160px)] relative overflow-hidden glass rounded-[2.5rem] border-sky-400/10">
                            <div id="graph-container" class="w-full h-full"></div>
                            
                            <div id="node-detail" class="absolute bottom-8 right-8 p-6 glass rounded-3xl hidden z-20 w-72 border-sky-400/30 shadow-2xl">
                                <!-- 节点详情内容 -->
                            </div>
                        </section>

                        <!-- 配置视图 -->
                        <section id="content-settings" class="view-section hidden space-y-8">
                            <div class="glass rounded-[2.5rem] p-10 border-sky-400/10 max-w-3xl">
                                <h3 class="text-2xl font-bold mb-8 text-white">LLM 认知接口配置</h3>
                                <div class="space-y-6">
                                    <!-- 配置项 -->
                                    <div class="space-y-2">
                                        <label class="text-xs font-bold text-sky-400/60 uppercase tracking-widest ml-1">API Endpoint</label>
                                        <input type="text" id="setting-llm-endpoint" class="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 focus:border-sky-500/50 outline-none transition-all mono text-sm" placeholder="https://api.openai.com/v1">
                                    </div>
                                    <!-- ... 其他配置项 ... -->
                                    <button id="save-settings-btn" class="w-full py-4 bg-sky-500 hover:bg-sky-600 rounded-2xl font-bold transition-all shadow-lg shadow-sky-500/20">
                                        保存配置
                                    </button>
                                </div>
                            </div>
                        </section>
                        
                        <!-- 事件流视图 -->
                        <section id="content-events" class="view-section hidden space-y-8">
                            <div id="full-event-list" class="space-y-6">
                                <!-- 事件列表 -->
                            </div>
                        </section>
                    </div>
                </main>
            `;

            this.overlay = overlay;
            document.body.appendChild(overlay);

            // 初始化图标
            lucide.createIcons();

            // 绑定事件
            this.bindEvents();
            
            // 初始化图谱
            this.initGraph();

            this.isInitialized = true;
            this.updateUI();
        }

        bindEvents() {
            // 侧边栏切换
            this.overlay.querySelectorAll('.nav-item').forEach(item => {
                item.onclick = () => {
                    const view = item.getAttribute('data-view');
                    this.switchView(view);
                };
            });

            // 关闭按钮
            this.overlay.querySelector('#pedsa-close-btn').onclick = () => {
                this.overlay.classList.add('hidden');
            };

            // 刷新按钮
            this.overlay.querySelector('#pedsa-refresh-btn').onclick = () => {
                this.updateUI();
            };

            // 配置保存
            this.overlay.querySelector('#save-settings-btn').onclick = () => {
                this.saveSettings();
            };
        }

        switchView(viewName) {
            this.activeView = viewName;
            
            // 更新 UI 状态
            this.overlay.querySelectorAll('.view-section').forEach(section => {
                section.classList.toggle('hidden', section.id !== `content-${viewName}`);
                if (section.id === `content-${viewName}`) {
                    setTimeout(() => section.classList.add('active'), 10);
                } else {
                    section.classList.remove('active');
                }
            });

            this.overlay.querySelectorAll('.nav-item').forEach(item => {
                item.classList.toggle('active-desktop', item.getAttribute('data-view') === viewName);
                if (item.getAttribute('data-view') !== viewName) {
                    item.classList.add('text-sky-100/50', 'hover:bg-white/5', 'hover:text-sky-200');
                } else {
                    item.classList.remove('text-sky-100/50', 'hover:bg-white/5', 'hover:text-sky-200');
                }
            });

            // 更新面包屑
            const breadcrumb = this.overlay.querySelector('#breadcrumb');
            const viewNames = {
                dashboard: 'Dashboard',
                network: 'Topology Network',
                events: 'Event Stream',
                settings: 'Core Settings'
            };
            breadcrumb.innerHTML = `System / <span class="text-sky-100">${viewNames[viewName]}</span>`;

            // 特殊处理图谱
            if (viewName === 'network') {
                setTimeout(() => {
                    if (this.graph) {
                        const container = this.overlay.querySelector('#graph-container');
                        this.graph.width(container.clientWidth);
                        this.graph.height(container.clientHeight);
                        this.graph.zoomToFit(400);
                    }
                }, 400);
            }
        }

        initGraph() {
            const container = this.overlay.querySelector('#graph-container');
            this.graph = ForceGraph()(container)
                .backgroundColor('rgba(0,0,0,0)')
                .nodeLabel(node => `${node.name} [${node.type === 1 ? '事件' : '本体'}]`)
                .nodeColor(node => node.color || '#38bdf8')
                .linkColor(() => 'rgba(56, 189, 248, 0.15)')
                .onNodeClick(node => {
                    this.showNodeDetail(node);
                });
            
            this.graph.d3Force('charge').strength(-350);
            this.graph.d3Force('link').distance(120);
        }

        showNodeDetail(node) {
            const detail = this.overlay.querySelector('#node-detail');
            detail.innerHTML = `
                <div class="flex justify-between items-start mb-4">
                    <div class="flex flex-col">
                        <span class="text-[9px] font-bold text-sky-400/60 uppercase tracking-widest mb-1">Node Detail</span>
                        <h4 class="text-xl font-bold text-sky-50">${node.name}</h4>
                    </div>
                    <button onclick="this.parentElement.parentElement.classList.add('hidden')" class="p-2 hover:bg-white/10 rounded-xl text-sky-400/50 hover:text-sky-400 transition-colors">
                        <i data-lucide="x" class="w-5 h-5"></i>
                    </button>
                </div>
                <div class="space-y-3 pt-4 border-t border-white/5">
                    <div class="flex justify-between items-center">
                        <span class="text-xs text-sky-400/60">激活能量</span>
                        <span class="mono text-xs text-sky-200 font-bold">${node.energy?.toFixed(4) || '0.0000'}</span>
                    </div>
                </div>
            `;
            detail.classList.remove('hidden');
            lucide.createIcons();
            
            this.graph.centerAt(node.x, node.y, 1000);
            this.graph.zoom(3, 1000);
        }

        updateUI() {
            if (!this.overlay) return;
            const state = this.pedsa.dashboard.getSnapshot();
            
            // 更新统计
            this.overlay.querySelector('#stat-nodes-count').innerText = state.graph.nodes.length;

            // 更新指纹
            if (state.fingerprint) {
                const f = state.fingerprint;
                const updateBar = (id, val) => {
                    const percent = Math.round(val * 100) + '%';
                    this.overlay.querySelector(`#text-${id}`).innerText = percent;
                    this.overlay.querySelector(`#bar-${id} > div`).style.width = percent;
                };
                updateBar('semantic', f.semantic);
                updateBar('temporal', f.temporal);
                updateBar('affective', f.affective);
                updateBar('entity', f.entity);
            }

            // 更新日志
            const logContainer = this.overlay.querySelector('#log-container');
            if (state.logs && state.logs.length > 0) {
                logContainer.innerHTML = state.logs.map(log => `
                    <div class="flex gap-2 leading-relaxed animate-fade-in">
                        <span class="text-sky-500/30 font-bold h-fit mt-0.5">${log.time.split(' ')[1]}</span>
                        <span class="text-sky-400 font-bold px-1.5 rounded bg-white/5 text-[9px] h-fit mt-0.5">${log.type}</span>
                        <span class="text-sky-100/80">${log.content}</span>
                    </div>
                `).join('');
                logContainer.scrollTop = logContainer.scrollHeight;
            }

            // 更新事件
            const eventContainer = this.overlay.querySelector('#event-list-container');
            if (state.events && state.events.length > 0) {
                eventContainer.innerHTML = state.events.slice(0, 4).map(ev => `
                    <div class="glass rounded-2xl p-5 border-l-4 border-l-sky-500 animate-fade-in">
                        <div class="flex justify-between items-start mb-3">
                            <span class="text-[10px] font-bold text-sky-400 uppercase tracking-widest bg-sky-500/10 px-2 py-0.5 rounded">Event</span>
                            <span class="text-[10px] mono text-sky-100/40">${ev.time}</span>
                        </div>
                        <p class="text-sky-100 text-sm leading-relaxed mb-4">${ev.summary}</p>
                        <div class="flex flex-wrap gap-2">
                            ${ev.features.map(f => `<span class="px-2 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-[9px] text-sky-300">#${f}</span>`).join('')}
                        </div>
                    </div>
                `).join('');
            }

            // 更新图谱
            if (this.graph) {
                this.graph.graphData(state.graph);
            }
        }

        saveSettings() {
            const settings = {
                endpoint: this.overlay.querySelector('#setting-llm-endpoint').value,
                // ... 其他设置
            };
            this.pedsa.dashboard.saveSettings(settings);
            const btn = this.overlay.querySelector('#save-settings-btn');
            btn.innerText = '已保存喵！';
            setTimeout(() => btn.innerText = '保存配置', 2000);
        }
    }

    // ==========================================
    // 1. SimHash.js
    // ==========================================
    class SimHash {
        constructor(value) {
            this.value = BigInt(value);
        }
        hammingDistance(other) {
            let xor = this.value ^ other.value;
            let distance = 0;
            let s = xor.toString(2);
            for (let char of s) {
                if (char === '1') distance++;
            }
            return distance;
        }
        similarity(other) {
            const distance = this.hammingDistance(other);
            return 1.0 - (distance / 64.0);
        }
        static build({ semantic = 0n, temporal = 0n, affective = 0n, entity = 0n }) {
            let val = (BigInt(semantic) & 0xFFFFFFFFn);
            val |= (BigInt(temporal) & 0xFFFFn) << 32n;
            val |= (BigInt(affective) & 0xFFn) << 48n;
            val |= (BigInt(entity) & 0xFFn) << 56n;
            return new SimHash(val);
        }
        static combine(hashes) {
            if (!hashes || hashes.length === 0) return new SimHash(0n);
            if (hashes.length === 1) return hashes[0];
            let bits = new Array(64).fill(0);
            for (const h of hashes) {
                let v = h.value;
                for (let i = 0; i < 64; i++) {
                    if ((v & (1n << BigInt(i))) !== 0n) {
                        bits[i]++;
                    } else {
                        bits[i]--;
                    }
                }
            }
            let result = 0n;
            for (let i = 0; i < 64; i++) {
                if (bits[i] > 0) {
                    result |= (1n << BigInt(i));
                }
            }
            return new SimHash(result);
        }
        getDimension(mask, shift) {
            return (this.value & mask) >> BigInt(shift);
        }
        similarityWeighted(other, mask) {
            let xor = (this.value ^ other.value) & mask;
            let distance = 0;
            let s = xor.toString(2);
            for (let char of s) {
                if (char === '1') distance++;
            }
            let maskStr = mask.toString(2);
            let totalBits = 0;
            for (let char of maskStr) {
                if (char === '1') totalBits++;
            }
            return totalBits === 0 ? 1.0 : 1.0 - (distance / totalBits);
        }
        static bitwiseMatch(h1, h2, mask) {
            const v1 = (h1 instanceof SimHash ? h1.value : BigInt(h1)) & mask;
            const v2 = (h2 instanceof SimHash ? h2.value : BigInt(h2)) & mask;
            return (v1 & v2) !== 0n;
        }
    }
    SimHash.MASKS = {
        SEMANTIC: BigInt("0x00000000FFFFFFFF"),
        TEMPORAL: BigInt("0x0000FFFF00000000"),
        AFFECTIVE: BigInt("0x00FF000000000000"),
        ENTITY: BigInt("0xFF00000000000000")
    };
    SimHash.EDGE_TYPES = {
        REPRESENTATION: 'representation',
        EQUALITY: 'equality',
        INHIBITION: 'inhibition',
    };

    // ==========================================
    // 2. Stopwords.js
    // ==========================================
    const STOPWORDS_SET = new Set([
        "的", "是", "了", "在", "我", "你", "他", "她", "它", "们", "这", "那", "都", "和", "并", "且",
        "也", "就", "着", "吧", "吗", "呢", "啊", "呀", "呜", "哎", "哼", "呸", "喽", "个", "只", "条",
        "件", "双", "本", "页", "次", "回", "场", "阵", "些", "点", "块", "片", "段", "层", "座", "栋",
        "a", "an", "the", "about", "above", "across", "after", "against", "along", "among", "around", "at", 
        "before", "behind", "below", "beneath", "beside", "between", "beyond", "but", "by", "despite", "down", 
        "during", "except", "for", "from", "in", "inside", "into", "like", "near", "of", "off", "on", "onto", 
        "out", "outside", "over", "past", "since", "through", "throughout", "till", "to", "toward", "under", 
        "underneath", "until", "up", "upon", "with", "within", "without",
        "i", "me", "my", "mine", "we", "us", "our", "ours", "you", "your", "yours", "he", "him", "his", 
        "she", "her", "hers", "it", "its", "they", "them", "their", "theirs", "this", "that", "these", "those", 
        "who", "whom", "whose", "which", "what", "each", "every", "either", "neither", "some", "any", "no", 
        "none", "both", "few", "many", "other", "another",
        "am", "is", "are", "was", "were", "be", "being", "been", "have", "has", "had", "do", "does", "did", 
        "shall", "will", "should", "would", "may", "might", "must", "can", "could",
        "and", "or", "so", "nor", "yet", "although", "because", "unless", "while", "where", "when", "how", "whether"
    ]);
    const Stopwords = {
        has: (word) => STOPWORDS_SET.has(word.toLowerCase())
    };

    // ==========================================
    // 3. AhoCorasick.js
    // ==========================================
    class AhoCorasick {
        constructor() {
            this.trie = [{ next: {}, fail: 0, output: [] }];
        }
        addPattern(pattern, data) {
            let node = 0;
            for (const char of pattern) {
                if (!this.trie[node].next[char]) {
                    this.trie[node].next[char] = this.trie.length;
                    this.trie.push({ next: {}, fail: 0, output: [] });
                }
                node = this.trie[node].next[char];
            }
            this.trie[node].output.push({ data, length: pattern.length });
        }
        build() {
            let queue = [];
            for (const char in this.trie[0].next) {
                let nextNode = this.trie[0].next[char];
                queue.push(nextNode);
            }
            while (queue.length > 0) {
                let u = queue.shift();
                for (const char in this.trie[u].next) {
                    let v = this.trie[u].next[char];
                    let fail = this.trie[u].fail;
                    while (fail > 0 && !this.trie[fail].next[char]) {
                        fail = this.trie[fail].fail;
                    }
                    if (this.trie[fail].next[char]) {
                        this.trie[v].fail = this.trie[fail].next[char];
                    } else {
                        this.trie[v].fail = 0;
                    }
                    this.trie[v].output = [...this.trie[v].output, ...this.trie[this.trie[v].fail].output];
                    queue.push(v);
                }
            }
        }
        search(text) {
            let node = 0;
            let results = [];
            for (let i = 0; i < text.length; i++) {
                const char = text[i];
                while (node > 0 && !this.trie[node].next[char]) {
                    node = this.trie[node].fail;
                }
                if (this.trie[node].next[char]) {
                    node = this.trie[node].next[char];
                } else {
                    node = 0;
                }
                if (this.trie[node].output.length > 0) {
                    for (const out of this.trie[node].output) {
                        results.push({
                            data: out.data,
                            length: out.length,
                            endPos: i
                        });
                    }
                }
            }
            return results;
        }
    }

    // ==========================================
    // 4. KeywordMatcher.js
    // ==========================================
    class KeywordMatcher {
        constructor() {
            this.ac = new AhoCorasick();
            this.definitions = []; 
            this.isBuilt = false;
        }
        register(keyword, nodeId) {
            this.definitions.push({ keyword: keyword.toLowerCase(), nodeId });
            this.isBuilt = false;
        }
        build() {
            this.definitions.sort((a, b) => b.keyword.length - a.keyword.length);
            this.ac = new AhoCorasick();
            for (const def of this.definitions) {
                this.ac.addPattern(def.keyword, def.nodeId);
            }
            this.ac.build();
            this.isBuilt = true;
        }
        match(text) {
            if (!this.isBuilt) this.build();
            const activations = new Map();
            const lowerText = text.toLowerCase();
            const matches = this.ac.search(lowerText);
            matches.sort((a, b) => {
                if (a.endPos !== b.endPos) return a.endPos - b.endPos;
                return b.length - a.length;
            });
            const covered = new Array(text.length).fill(false);
            for (const match of matches) {
                const startPos = match.endPos - match.length + 1;
                let isCovered = false;
                for (let i = startPos; i <= match.endPos; i++) {
                    if (covered[i]) {
                        isCovered = true;
                        break;
                    }
                }
                if (!isCovered) {
                    for (let i = startPos; i <= match.endPos; i++) {
                        covered[i] = true;
                    }
                    const nodeId = match.data;
                    const currentEnergy = activations.get(nodeId) || 0;
                    activations.set(nodeId, Math.min(2.0, currentEnergy + 1.0));
                }
            }
            return activations;
        }
        loadDefinitions(definitions) {
            for (let def of definitions) {
                this.register(def.keyword, def.nodeId);
            }
        }
    }

    // ==========================================
    // 5. GraphEngine.js
    // ==========================================
    class GraphEngine {
        constructor() {
            this.nodes = new Map();
            this.edges = new Map(); 
            this.ontologyEdges = new Map();
            this.memoryEdges = new Map();
            this.temporalIndex = new Map();
            this.affectiveIndex = new Map();
            this.inDegrees = new Map();
            this.eventChronology = [];
            this.storyTime = 0;
        }
        advanceClock(delta = 1) {
            this.storyTime += delta;
        }
        addNode(node) {
            this.nodes.set(node.id, {
                ...node,
                energy: 0,
            });
            if (node.nodeType === 1) {
                if (node.storyDay !== undefined) {
                    if (!this.temporalIndex.has(node.storyDay)) {
                        this.temporalIndex.set(node.storyDay, []);
                    }
                    this.temporalIndex.get(node.storyDay).push(node.id);
                }
                if (node.simhash) {
                    const s = new SimHash(node.simhash);
                    const aff = s.getDimension(SimHash.MASKS.AFFECTIVE, 48);
                    if (aff > 0n) {
                        for (let i = 0; i < 8; i++) {
                            const bit = 1n << BigInt(i);
                            if ((aff & bit) !== 0n) {
                                if (!this.affectiveIndex.has(Number(bit))) {
                                    this.affectiveIndex.set(Number(bit), []);
                                }
                                this.affectiveIndex.get(Number(bit)).push(node.id);
                            }
                        }
                    }
                }
                if (this.eventChronology.length > 0) {
                    const prevEventId = this.eventChronology[this.eventChronology.length - 1];
                    this.addEdge(prevEventId, node.id, 0.8, 'temporal_sequence');
                    this.addEdge(node.id, prevEventId, 0.5, 'temporal_sequence');
                }
                this.eventChronology.push(node.id);
            }
        }
        addEdge(fromId, toId, weight = 1.0, type = SimHash.EDGE_TYPES.REPRESENTATION) {
            const fromNode = this.nodes.get(fromId);
            const toNode = this.nodes.get(toId);
            const targetMap = (fromNode?.nodeType === 0 && toNode?.nodeType === 0) 
                ? this.ontologyEdges 
                : this.memoryEdges;
            if (!targetMap.has(fromId)) {
                targetMap.set(fromId, []);
            }
            const edges = targetMap.get(fromId);
            const existingEdge = edges.find(e => e.toId === toId);
            if (existingEdge) {
                existingEdge.weight = Math.min(1.0, existingEdge.weight + (weight * 0.5));
                if (type === SimHash.EDGE_TYPES.EQUALITY || type === SimHash.EDGE_TYPES.INHIBITION) {
                    existingEdge.type = type;
                }
            } else {
                edges.push({ toId, weight, type });
                this.inDegrees.set(toId, (this.inDegrees.get(toId) || 0) + 1);
            }
        }
        diffuse(initialActivations, options = {}) {
            const {
                decay = 0.85,
                threshold = 0.05,
                ontologySteps = 2,
                memorySteps = 1,
                layerLimit = 5000,
                maxTotalEnergy = 10.0,
                querySimHash = null
            } = options;
            for (let node of this.nodes.values()) node.energy = 0;
            const queryHashObj = querySimHash ? new SimHash(querySimHash) : null;
            let activatedKeywords = new Map(initialActivations);
            if (queryHashObj) {
                const qTime = Number(queryHashObj.getDimension(SimHash.MASKS.TEMPORAL, 32));
                if (qTime > 0 && this.temporalIndex.has(qTime)) {
                    for (const nodeId of this.temporalIndex.get(qTime)) {
                        const current = activatedKeywords.get(nodeId) || 0;
                        activatedKeywords.set(nodeId, Math.max(current, 0.6));
                    }
                }
                const qAff = queryHashObj.getDimension(SimHash.MASKS.AFFECTIVE, 48);
                if (qAff > 0n) {
                    for (let i = 0; i < 8; i++) {
                        const bit = 1n << BigInt(i);
                        if ((qAff & bit) !== 0n && this.affectiveIndex.has(Number(bit))) {
                            for (const nodeId of this.affectiveIndex.get(Number(bit))) {
                                const current = activatedKeywords.get(nodeId) || 0;
                                activatedKeywords.set(nodeId, Math.max(current, 0.7));
                            }
                        }
                    }
                }
            }
            let ontologyLayer = new Map(activatedKeywords);
            for (let step = 0; step < ontologySteps; step++) {
                const nextOntologyLayer = new Map();
                for (let [sourceId, score] of ontologyLayer) {
                    const neighbors = this.ontologyEdges.get(sourceId) || [];
                    for (const edge of neighbors) {
                        const inDegree = this.inDegrees.get(edge.toId) || 1;
                        const inhibitionFactor = 1.0 / (1.0 + Math.log10(inDegree));
                        let addedEnergy = 0;
                        if (edge.type === SimHash.EDGE_TYPES.EQUALITY) {
                            addedEnergy = score * edge.weight;
                        } else if (edge.type === SimHash.EDGE_TYPES.INHIBITION) {
                            addedEnergy = -(score * edge.weight * decay * inhibitionFactor);
                        } else {
                            addedEnergy = score * edge.weight * 0.95 * inhibitionFactor;
                        }
                        if (Math.abs(addedEnergy) > threshold) {
                            const current = nextOntologyLayer.get(edge.toId) || 0;
                            nextOntologyLayer.set(edge.toId, Math.max(current, addedEnergy));
                        }
                    }
                }
                for (let [id, energy] of nextOntologyLayer) {
                    ontologyLayer.set(id, Math.max(ontologyLayer.get(id) || 0, energy));
                }
            }
            let totalOntologyEnergy = 0;
            for (let e of ontologyLayer.values()) if (e > 0) totalOntologyEnergy += e;
            if (totalOntologyEnergy > maxTotalEnergy) {
                const factor = maxTotalEnergy / totalOntologyEnergy;
                for (let [id, e] of ontologyLayer) ontologyLayer.set(id, e * factor);
            }
            let seeds = Array.from(ontologyLayer.entries())
                .filter(e => e[1] > threshold)
                .sort((a, b) => b[1] - a[1]);
            if (seeds.length > layerLimit) seeds = seeds.slice(0, layerLimit);
            const finalScores = new Map(ontologyLayer);
            let memoryLayer = new Map(seeds);
            for (let step = 0; step < memorySteps; step++) {
                const nextMemoryLayer = new Map();
                for (let [sourceId, score] of memoryLayer) {
                    const neighbors = this.memoryEdges.get(sourceId) || [];
                    const sourceNode = this.nodes.get(sourceId);
                    for (const edge of neighbors) {
                        const targetNode = this.nodes.get(edge.toId);
                        if (!targetNode) continue;
                        const inDegree = this.inDegrees.get(edge.toId) || 1;
                        const inhibitionFactor = 1.0 / (1.0 + Math.log10(inDegree));
                        let resonanceBoost = 1.0;
                        if (sourceNode?.simhash && targetNode.simhash) {
                            const s1 = new SimHash(sourceNode.simhash);
                            const s2 = new SimHash(targetNode.simhash);
                            if (SimHash.bitwiseMatch(s1, s2, SimHash.MASKS.AFFECTIVE)) resonanceBoost += 0.3;
                            if (sourceNode.storyDay !== undefined && targetNode.storyDay !== undefined && sourceNode.storyDay === targetNode.storyDay) {
                                resonanceBoost += 0.2;
                            }
                        }
                        if (queryHashObj && targetNode.simhash) {
                            const tHash = new SimHash(targetNode.simhash);
                            const semSim = queryHashObj.similarityWeighted(tHash, SimHash.MASKS.SEMANTIC);
                            resonanceBoost += semSim * 0.5;
                        }
                        let energy = score * edge.weight * decay * inhibitionFactor * resonanceBoost;
                        if (energy > threshold * 0.5) {
                            const current = nextMemoryLayer.get(edge.toId) || 0;
                            nextMemoryLayer.set(edge.toId, current + energy);
                        }
                    }
                }
                for (let [id, energy] of nextMemoryLayer) {
                    finalScores.set(id, (finalScores.get(id) || 0) + energy);
                    memoryLayer = nextMemoryLayer;
                }
            }
            for (let [id, energy] of finalScores) {
                const node = this.nodes.get(id);
                if (node) node.energy = energy;
            }
            return Array.from(this.nodes.values())
                .filter(node => node.nodeType === 1 && node.energy > 0)
                .map(node => {
                    if (queryHashObj && node.simhash) {
                        const nodeHash = new SimHash(node.simhash);
                        const semanticSim = queryHashObj.similarityWeighted(nodeHash, SimHash.MASKS.SEMANTIC);
                        let resonanceBoost = semanticSim * 0.6;
                        if ((queryHashObj.value & SimHash.MASKS.TEMPORAL) !== 0n) {
                            const temporalSim = queryHashObj.similarityWeighted(nodeHash, SimHash.MASKS.TEMPORAL);
                            resonanceBoost += temporalSim * 0.5;
                        }
                        if ((queryHashObj.value & SimHash.MASKS.AFFECTIVE) !== 0n) {
                            if (SimHash.bitwiseMatch(queryHashObj, nodeHash, SimHash.MASKS.AFFECTIVE)) {
                                resonanceBoost += 0.6;
                            }
                        }
                        if ((queryHashObj.value & SimHash.MASKS.ENTITY) !== 0n) {
                            const typeSim = queryHashObj.similarityWeighted(nodeHash, SimHash.MASKS.ENTITY);
                            resonanceBoost += typeSim * 0.8;
                        }
                        node.energy += resonanceBoost;
                    }
                    return node;
                })
                .sort((a, b) => b.energy - a.energy);
        }
        exportState() {
            return {
                nodes: Array.from(this.nodes.entries()),
                edges: Array.from(this.edges.entries())
            };
        }
        importState(state) {
            if (!state) return;
            this.nodes = new Map(state.nodes);
            this.edges = new Map(state.edges);
        }
    }

    // ==========================================
    // 6. OntologyManager.js
    // ==========================================
    class OntologyManager {
        constructor(engine, matcher) {
            this.engine = engine;
            this.matcher = matcher;
            this.emotionMap = OntologyManager.EMOTION_MAP;
            this.typeMap = OntologyManager.TYPE_MAP;
        }
        applyUpdate(data) {
            const { new_event, ontology_updates } = data;
            if (ontology_updates) {
                for (const update of ontology_updates) {
                    this._handleOntologyUpdate(update);
                }
            }
            if (new_event) {
                this._handleNewEvent(new_event);
            }
            this.matcher.build();
        }
        _handleOntologyUpdate(update) {
            const { source, target, relation_type, strength } = update;
            if (!this._ensureOntologyNode(source)) return;
            if (!this._ensureOntologyNode(target)) return;
            let finalWeight = strength;
            let finalType = relation_type;
            if (relation_type === 'inhibition') {
                finalType = SimHash.EDGE_TYPES.INHIBITION;
            } else if (relation_type === 'equality') {
                finalType = SimHash.EDGE_TYPES.EQUALITY;
            } else {
                finalType = SimHash.EDGE_TYPES.REPRESENTATION;
            }
            this.engine.addEdge(source, target, finalWeight, finalType);
            if (relation_type === 'equality') {
                this.engine.addEdge(target, source, finalWeight, finalType);
            }
            this.matcher.register(source, source);
            this.matcher.register(target, target);
        }
        _handleNewEvent(event) {
            const { summary, features, type, emotion, time, raw } = event;
            const storyTimestamp = this.engine.storyTime;
            const eventId = `event_${storyTimestamp}_${Math.floor(Math.random() * 1000)}`;
            const simhash = SimHash.build({
                affective: this.emotionMap[emotion] || 0n,
                entity: this.typeMap[type] || 0n,
                temporal: BigInt(time !== undefined ? time : storyTimestamp),
                semantic: BigInt(this._simpleHash(summary))
            });
            this.engine.addNode({
                id: eventId,
                name: summary,
                nodeType: 1,
                simhash: simhash.value,
                timestamp: storyTimestamp, 
                storyDay: time !== undefined ? time : storyTimestamp,
                category: type,
                sentiment: emotion,
                raw: raw,
                features: features
            });
            if (features) {
                for (const feature of features) {
                    if (!this._ensureOntologyNode(feature)) continue;
                    this.engine.addEdge(feature, eventId, 1.0, 'representation');
                    this.engine.addEdge(eventId, feature, 0.5, 'representation');
                    this.matcher.register(feature, feature);
                }
            }
        }
        _ensureOntologyNode(name) {
            if (Stopwords.has(name) || name.length < 1) {
                return false;
            }
            if (!this.engine.nodes.has(name)) {
                this.engine.addNode({
                    id: name,
                    name: name,
                    nodeType: 0,
                    simhash: SimHash.build({ semantic: BigInt(this._simpleHash(name)) }).value
                });
            }
            return true;
        }
        _simpleHash(str) {
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                hash = ((hash << 5) - hash) + str.charCodeAt(i);
                hash |= 0;
            }
            return Math.abs(hash);
        }
    }
    OntologyManager.EMOTION_MAP = {
        'JOY': 1n << 0n,
        'SHY': 1n << 1n,
        'FEAR': 1n << 2n,
        'SURPRISE': 1n << 3n,
        'SADNESS': 1n << 4n,
        'DISGUST': 1n << 5n,
        'ANGER': 1n << 6n,
        'ANTICIPATION': 1n << 7n
    };
    OntologyManager.TYPE_MAP = {
        'PERSON': 1n << 0n,
        'TECH': 1n << 1n,
        'EVENT': 1n << 2n,
        'LOCATION': 1n << 3n,
        'OBJECT': 1n << 4n,
        'VALUES': 1n << 5n
    };

    // ==========================================
    // 7. QueryGenerator.js
    // ==========================================
    class QueryGenerator {
        constructor(engine, matcher, maps) {
            this.engine = engine;
            this.matcher = matcher;
            this.emotionMap = maps.emotionMap;
            this.typeMap = maps.typeMap;
        }
        generate(text, context) {
            const activations = this.matcher.match(text);
            const matchedHashes = [];
            for (const nodeId of activations.keys()) {
                const node = this.engine.nodes.get(nodeId);
                if (node && node.simhash) {
                    matchedHashes.push(new SimHash(node.simhash));
                }
            }
            let baseHash = SimHash.combine(matchedHashes);
            const affective = this.emotionMap[context.emotion] || 0n;
            const entity = this.typeMap[context.type] || 0n;
            let targetStoryTime = BigInt(this.engine.storyTime); 
            const timeRules = [
                { regex: /今天|今日|此刻|当前|现在|today|now|current/, offset: 0 },
                { regex: /昨天|昨日|昨晚|yesterday|last night/, offset: -1 },
                { regex: /前天|前日|the day before yesterday/, offset: -2 },
                { regex: /大前天/, offset: -3 },
                { regex: /刚[才刚]|just now/, offset: 0 },
                { regex: /最近|前些[天日]|recently|lately|a few days ago/, offset: -3 },
                { regex: /上个?星期|上周|last week/, offset: -7 },
                { regex: /上个?月|上月|last month/, offset: -30 },
                { regex: /去年|last year/, offset: -365 },
                { regex: /(\d+)\s*天前|(\d+)\s*days? ago/, offset: (match) => -parseInt(match[1] || match[2]) },
                { regex: /(\d+)\s*个?星期前|(\d+)\s*weeks? ago/, offset: (match) => -parseInt(match[1] || match[2]) * 7 },
                { regex: /(\d+)\s*个?月前|(\d+)\s*months? ago/, offset: (match) => -parseInt(match[1] || match[2]) * 30 },
                { regex: /(\d+)\s*年前|(\d+)\s*years? ago/, offset: (match) => -parseInt(match[1] || match[2]) * 365 }
            ];
            for (const rule of timeRules) {
                const match = text.match(rule.regex);
                if (match) {
                    const offset = typeof rule.offset === 'function' ? rule.offset(match) : rule.offset;
                    targetStoryTime = BigInt(Math.max(0, this.engine.storyTime + offset));
                    break;
                }
            }
            const temporal = targetStoryTime;
            let val = baseHash.value;
            val = (val & ~SimHash.MASKS.TEMPORAL) | ((temporal & 0xFFFFn) << 32n);
            val = (val & ~SimHash.MASKS.AFFECTIVE) | ((affective & 0xFFn) << 48n);
            val = (val & ~SimHash.MASKS.ENTITY) | ((entity & 0xFFn) << 56n);
            return new SimHash(val);
        }
    }

    // ==========================================
    // 8. DashboardManager.js
    // ==========================================
    class DashboardManager {
        constructor(engine, matcher) {
            this.engine = engine;
            this.matcher = matcher;
            this.logs = [];
            this.maxLogs = 50;
            this.events = [];
            this.maxEvents = 100;
            this.settings = this._loadSettings();
            this.lastResonance = {
                semantic: 0,
                affective: 0,
                entity: 0,
                temporal: 0
            };
            this.queryCount = 0;
            this._setupHooks();
        }
        updateResonance(queryHash, topNodeHash) {
            if (!queryHash || !topNodeHash) return;
            const q = new SimHash(queryHash);
            const t = new SimHash(topNodeHash);
            const calculateMatch = (mask, shift, bits) => {
                const v1 = q.getDimension(mask, shift);
                const v2 = t.getDimension(mask, shift);
                let xor = v1 ^ v2;
                let distance = 0;
                let s = xor.toString(2);
                for (let char of s) if (char === '1') distance++;
                return Math.max(0, 100 - (distance / bits) * 100);
            };
            this.lastResonance = {
                semantic: Math.floor(calculateMatch(SimHash.MASKS.SEMANTIC, 0, 32)),
                temporal: Math.floor(calculateMatch(SimHash.MASKS.TEMPORAL, 32, 16)),
                affective: Math.floor(calculateMatch(SimHash.MASKS.AFFECTIVE, 48, 8)),
                entity: Math.floor(calculateMatch(SimHash.MASKS.ENTITY, 56, 8))
            };
            this.queryCount++;
            if (this.onUpdate) this.onUpdate('resonance', this.lastResonance);
        }
        _loadSettings() {
            if (typeof window !== 'undefined' && window.localStorage) {
                const saved = localStorage.getItem('pedsa_settings');
                if (saved) {
                    try {
                        return JSON.parse(saved);
                    } catch (e) {
                        console.error('[PEDSA] 加载配置失败:', e);
                    }
                }
            }
            return {
                endpoint: '',
                key: '',
                model: 'gpt-3.5-turbo',
                frequency: 5
            };
        }
        saveSettings(newSettings) {
            this.settings = { ...this.settings, ...newSettings };
            if (typeof window !== 'undefined' && window.localStorage) {
                localStorage.setItem('pedsa_settings', JSON.stringify(this.settings));
            }
            this.log('INF', '系统配置已保存');
            if (this.onSettingsUpdate) this.onSettingsUpdate(this.settings);
        }
        addEvent(event) {
            const fullEvent = {
                id: Date.now().toString(),
                time: new Date().toLocaleString('zh-CN'),
                ...event
            };
            this.events.push(fullEvent);
            if (this.events.length > this.maxEvents) this.events.shift();
            if (this.onUpdate) this.onUpdate('event', fullEvent);
        }
        getSnapshot() {
            const nodes = Array.from(this.engine.nodes.values());
            const allEdges = [];
            const processMap = (map) => {
                for (const [fromId, edges] of map) {
                    edges.forEach(e => {
                        allEdges.push({
                            source: fromId,
                            target: e.toId,
                            strength: e.weight,
                            type: e.type
                        });
                    });
                }
            };
            processMap(this.engine.ontologyEdges);
            processMap(this.engine.memoryEdges);
            const avgEnergy = nodes.length > 0 
                ? nodes.reduce((sum, n) => sum + n.energy, 0) / nodes.length 
                : 0;
            return {
                stats: {
                    nodeCount: nodes.length,
                    edgeCount: allEdges.length,
                    avgEnergy: parseFloat(avgEnergy.toFixed(2)),
                    queryCount: this.queryCount,
                    storyTime: this.engine.storyTime,
                    density: nodes.length > 0 ? (allEdges.length / nodes.length).toFixed(2) : '0.00'
                },
                graph: {
                    nodes: nodes.map(n => ({
                        id: n.id,
                        name: n.name,
                        val: (n.energy * 20) + 5,
                        color: n.nodeType === 0 ? '#38bdf8' : '#f472b6',
                        energy: n.energy,
                        type: n.nodeType,
                        category: n.category,
                        sentiment: n.sentiment
                    })),
                    links: allEdges
                },
                resonance: this.lastResonance,
                logs: this.logs.slice(-20).reverse(),
                events: nodes
                    .filter(n => n.nodeType === 1)
                    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
                    .slice(0, 50)
                    .map(n => ({
                        id: n.id,
                        time: `故事第 ${n.storyDay || 0} 天`,
                        summary: n.name,
                        raw: n.raw || '（无原始对话记录）',
                        features: n.features || [],
                        type: n.category,
                        emotion: n.sentiment
                    })),
                settings: this.settings
            };
        }
        log(type, content) {
            const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });
            const entry = { time, type, content };
            this.logs.push(entry);
            if (this.logs.length > this.maxLogs) this.logs.shift();
            if (this.onUpdate) this.onUpdate('log', entry);
        }
        async getDashboardHTML() {
            return ""; 
        }
        _setupHooks() {
            const originalDiffuse = this.engine.diffuse.bind(this.engine);
            this.engine.diffuse = (initialActivations, options) => {
                const activeIds = Array.from(initialActivations).map(a => Array.isArray(a) ? a[0] : a.id);
                this.log('INF', `检测到关键词激活: ${activeIds.join(', ')}`);
                const results = originalDiffuse(initialActivations, options);
                this.log('DIF', `图扩散完成，共激活 ${results.length} 个节点`);
                if (results.length > 0) {
                    this.log('REC', `最高能量召回: "${results[0].name}" (Energy: ${results[0].energy.toFixed(2)})`);
                }
                return results;
            };
        }
    }

    // ==========================================
    // 9. TavernIntegration.js
    // ==========================================
    class TavernIntegration {
        constructor(engine, dashboard, matcher, ontologyMaps) {
            this.engine = engine;
            this.dashboard = dashboard;
            this.matcher = matcher;
            const maps = ontologyMaps || {
                emotionMap: OntologyManager.EMOTION_MAP,
                typeMap: OntologyManager.TYPE_MAP
            };
            this.queryGenerator = new QueryGenerator(engine, matcher, maps);
            this.ontologyManager = new OntologyManager(engine, matcher);
            this.messageBuffer = [];
            this.settings = {
                endpoint: '',
                key: '',
                model: 'gpt-3.5-turbo',
                frequency: 5 
            };
            this.roundCounter = 0;
            this.lastContext = {
                emotion: 'JOY',
                type: 'PERSON'
            };
            this._initEvents();
        }
        updateSettings(newSettings) {
            this.settings = { ...this.settings, ...newSettings };
            this.dashboard.log('INF', `[TavernIntegration] 配置已更新: ${this.settings.model} (每 ${this.settings.frequency} 轮总结)`);
        }
        _initEvents() {
            const tryInit = () => {
                if (typeof window === 'undefined' || !window.SillyTavern) {
                    return false;
                }
                try {
                    const context = window.SillyTavern.getContext();
                    const eventSource = context.eventSource;
                    if (!eventSource) {
                        return false;
                    }
                    eventSource.on('message_sent', (payload) => this._handleMessage('user', payload));
                    eventSource.on('message_received', (payload) => this._handleMessage('char', payload));
                    eventSource.on('message_deleted', (payload) => this._handleRecall(payload));
                    this.dashboard.log('INF', '[TavernIntegration] 酒馆事件监听已启动喵~');
                    return true;
                } catch (err) {
                    console.error('[PEDSA] 初始化酒馆事件监听失败:', err);
                    return false;
                }
            };
            if (!tryInit()) {
                let retries = 0;
                const interval = setInterval(() => {
                    retries++;
                    if (tryInit() || retries > 10) {
                        clearInterval(interval);
                        if (retries > 10) {
                            console.warn('[PEDSA] 酒馆事件监听初始化超时，请检查 SillyTavern 环境喵~');
                        }
                    }
                }, 1000);
            }
        }
        async _handleMessage(role, payload) {
            const content = payload.mes || '';
            if (!content) return;
            if (role === 'user') {
                this.dashboard.log('INF', `[PEDSA] 正在检索共鸣记忆: "${content.substring(0, 20)}..."`);
                const querySimHash = this.queryGenerator.generate(content, this.lastContext);
                const initialActivations = this.matcher.match(content);
                const activatedEvents = this.engine.diffuse(initialActivations, {
                    querySimHash: querySimHash.value 
                });
                if (activatedEvents.length > 0) {
                    const topEvent = activatedEvents[0];
                    this.dashboard.log('INF', `[PEDSA] 唤醒记忆: "${topEvent.name}" (共鸣分: ${topEvent.energy.toFixed(2)})`);
                    this.dashboard.updateResonance(querySimHash.value, topEvent.simhash);
                } else {
                    this.dashboard.updateResonance(querySimHash.value, querySimHash.value);
                }
            }
            this.messageBuffer.push({ role, content, time: new Date().toISOString() });
            if (role === 'char') {
                this.roundCounter++;
                this.dashboard.log('INF', `[TavernIntegration] 对话轮次: ${this.roundCounter}/${this.settings.frequency}`);
                if (this.roundCounter >= this.settings.frequency) {
                    await this._triggerSummary();
                    this.roundCounter = 0;
                    this.messageBuffer = []; 
                }
            }
        }
        _handleRecall(payload) {
            this.dashboard.log('INF', `[TavernIntegration] 检测到消息撤回 (ID: ${payload.id || '未知'})，图谱同步功能已就绪`);
        }
        async _triggerSummary() {
            if (!this.settings.endpoint || !this.settings.key) {
                this.dashboard.log('ERR', '[TavernIntegration] 未配置 LLM API，跳过总结构建');
                return;
            }
            this.dashboard.log('INF', '[TavernIntegration] 正在调用 LLM 进行图谱总结与构建...');
            const userMsgs = this.messageBuffer.filter(m => m.role === 'user').map(m => m.content).join('\n');
            const charMsgs = this.messageBuffer.filter(m => m.role === 'char').map(m => m.content).join('\n');
            try {
                const result = await this._callLLM(userMsgs, charMsgs);
                if (result && result.new_event) {
                    this.engine.advanceClock(1);
                    this.lastContext.emotion = result.new_event.emotion;
                    this.lastContext.type = result.new_event.type;
                    const rawText = `用户: ${userMsgs.substring(0, 100)}${userMsgs.length > 100 ? '...' : ''} / AI: ${charMsgs.substring(0, 100)}${charMsgs.length > 100 ? '...' : ''}`;
                    result.new_event.raw = rawText;
                    this.ontologyManager.applyUpdate(result);
                    this.dashboard.addEvent({
                        raw: rawText,
                        summary: result.new_event.summary,
                        type: result.new_event.type,
                        emotion: result.new_event.emotion,
                        time: result.new_event.time, 
                        features: result.new_event.features
                    });
                    this.dashboard.log('INF', `[TavernIntegration] 图谱维护完成: ${result.new_event.summary} (剧情时钟: ${this.engine.storyTime})`);
                }
            } catch (err) {
                this.dashboard.log('ERR', `[TavernIntegration] LLM 调用失败: ${err.message}`);
            }
        }
        async _callLLM(userContent, charResponse) {
            const storyDay = this.engine.storyTime;
            const prompt = `# 图谱构建提示词\n\n你是一个专业的知识图谱架构师... (省略长提示词以节省流量, 保持原逻辑) ...`;
            const response = await fetch(`${this.settings.endpoint}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.settings.key}`
                },
                body: JSON.stringify({
                    model: this.settings.model,
                    messages: [{ role: 'user', content: prompt + `\n\n**当前故事天数 (Current Story Day)**: \`第 ${storyDay} 天\`\n**对话上下文**:\n- **用户**: "${userContent}"\n- **AI**: "${charResponse}"` }],
                    temperature: 0.3,
                    response_format: { type: "json_object" }
                })
            });
            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status}`);
            }
            const data = await response.json();
            const content = data.choices[0].message.content;
            return JSON.parse(content);
        }
    }

    // ==========================================
    // 10. PEDSA Main
    // ==========================================
    class PEDSAUI {
    constructor(parent) {
        this.parent = parent;
        this.isInitialized = false;
        this.isVisible = false;
        this.overlay = null;
        this.graph = null;
        this.activeView = 'dashboard';
        this.state = null;
        this.resourcesLoaded = false;
    }

    /**
     * 加载 UI 依赖资源喵~
     */
    async _loadResources() {
        if (this.resourcesLoaded) return;

        const scripts = [
            'https://cdn.tailwindcss.com',
            'https://unpkg.com/lucide@latest',
            'https://unpkg.com/force-graph'
        ];

        const loadScript = (src) => new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });

        try {
            console.log('[PEDSA] 正在加载 UI 依赖资源... 喵~');
            await Promise.all(scripts.map(loadScript));
            this.resourcesLoaded = true;
            console.log('[PEDSA] UI 资源加载完成！');
        } catch (err) {
            console.error('[PEDSA] UI 资源加载失败喵！', err);
        }
    }

    /**
     * 渲染 UI 喵~
     */
    async render() {
        if (!this.isInitialized) {
            await this._loadResources();
            this._createOverlay();
            this.isInitialized = true;
        }

        this.isVisible = !this.isVisible;
        if (this.isVisible) {
            this.overlay.style.display = 'flex';
            this.overlay.classList.remove('opacity-0', 'pointer-events-none');
            this.overlay.classList.add('opacity-100');
            this.updateUI();
            // 每次打开时如果是在图谱页，刷新一下图谱喵~
            if (this.activeView === 'network') {
                this._renderGraph();
            }
            // 重新运行 lucide 图标渲染喵~
            if (window.lucide) window.lucide.createIcons();
        } else {
            this.overlay.classList.remove('opacity-100');
            this.overlay.classList.add('opacity-0', 'pointer-events-none');
            setTimeout(() => {
                if (!this.isVisible) this.overlay.style.display = 'none';
            }, 300);
        }
    }

    /**
     * 创建全屏 Overlay 喵~
     */
    _createOverlay() {
        this.overlay = document.createElement('div');
        this.overlay.id = 'pedsa-ui-overlay';
        this.overlay.className = 'fixed inset-0 z-[9999] bg-[#020617] text-[#f0f9ff] flex flex-col md:flex-row transition-opacity duration-300 opacity-0 pointer-events-none';
        this.overlay.style.display = 'none';
        this.overlay.style.fontFamily = "'Noto Sans SC', sans-serif";

        // 注入样式喵~
        const style = document.createElement('style');
        style.textContent = `
            @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Noto+Sans+SC:wght@300;400;500;700&display=swap');
            #pedsa-ui-overlay .glass { background: rgba(255, 255, 255, 0.03); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.08); }
            #pedsa-ui-overlay .glass-dark { background: rgba(0, 0, 0, 0.2); backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.05); }
            #pedsa-ui-overlay .text-gradient { background: linear-gradient(to right, #7dd3fc, #38bdf8, #0ea5e9); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
            #pedsa-ui-overlay .nav-item.active { background: rgba(56, 189, 248, 0.1); color: #7dd3fc; border-color: rgba(56, 189, 248, 0.2); }
            #pedsa-ui-overlay .view-section { display: none; }
            #pedsa-ui-overlay .view-section.active { display: flex; flex-direction: column; height: 100%; }
            #pedsa-ui-overlay ::-webkit-scrollbar { width: 4px; }
            #pedsa-ui-overlay ::-webkit-scrollbar-thumb { background: rgba(56, 189, 248, 0.3); border-radius: 10px; }
            @keyframes pedsa-pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }
            #pedsa-ui-overlay .energy-pulse { animation: pedsa-pulse 3s infinite ease-in-out; }
        `;
        document.head.appendChild(style);

        this.overlay.innerHTML = `
            <!-- 侧边栏 -->
            <aside class="w-64 glass-dark border-r border-white/5 flex flex-col p-6 z-10 hidden md:flex">
                <div class="flex items-center gap-3 mb-10">
                    <div class="p-2 bg-sky-500/20 rounded-xl border border-sky-400/30">
                        <i data-lucide="brain" class="text-sky-400 w-6 h-6"></i>
                    </div>
                    <div>
                        <h1 class="font-bold text-lg tracking-tight text-gradient">PEDSA-JS</h1>
                        <p class="text-[10px] text-sky-500/70 uppercase tracking-widest font-bold">Cognitive Core</p>
                    </div>
                </div>
                <nav class="space-y-3 flex-1">
                    <button data-view="dashboard" class="nav-item w-full flex items-center gap-3 p-3 rounded-xl border border-transparent transition-all active">
                        <i data-lucide="layout-dashboard" class="w-5 h-5"></i>
                        <span class="font-medium">仪表盘</span>
                    </button>
                    <button data-view="network" class="nav-item w-full flex items-center gap-3 p-3 rounded-xl border border-transparent transition-all">
                        <i data-lucide="network" class="w-5 h-5"></i>
                        <span>图谱查看</span>
                    </button>
                    <button data-view="events" class="nav-item w-full flex items-center gap-3 p-3 rounded-xl border border-transparent transition-all">
                        <i data-lucide="list-checks" class="w-5 h-5"></i>
                        <span>事件列表</span>
                    </button>
                    <button data-view="settings" class="nav-item w-full flex items-center gap-3 p-3 rounded-xl border border-transparent transition-all">
                        <i data-lucide="settings" class="w-5 h-5"></i>
                        <span>系统配置</span>
                    </button>
                </nav>
                <div class="mt-auto pt-6 border-t border-white/5 flex flex-col gap-4">
                    <div class="flex items-center gap-3 text-xs text-sky-400/70">
                        <div class="w-2 h-2 bg-sky-400 rounded-full energy-pulse"></div>
                        <span>引擎状态: 运行中</span>
                    </div>
                    <button id="pedsa-close-btn" class="flex items-center justify-center gap-2 p-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all text-sm">
                        <i data-lucide="log-out" class="w-4 h-4"></i>
                        <span>关闭面板</span>
                    </button>
                </div>
            </aside>

            <!-- 主内容区 -->
            <main class="flex-1 overflow-y-auto p-4 md:p-8 relative">
                <!-- 仪表盘 -->
                <section id="pedsa-view-dashboard" class="view-section active">
                    <header class="flex justify-between items-center mb-8">
                        <div>
                            <h2 class="text-3xl font-bold tracking-tight text-sky-50">系统概览</h2>
                            <p class="text-sky-400/60 text-sm font-medium">实时监控记忆扩散与图谱状态</p>
                        </div>
                    </header>
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                        <div class="p-6 glass rounded-3xl"><div class="text-sky-400/60 text-[10px] uppercase font-bold mb-2">总节点数</div><div class="text-4xl font-bold" id="pedsa-stat-nodes">0</div></div>
                        <div class="p-6 glass rounded-3xl"><div class="text-sky-400/60 text-[10px] uppercase font-bold mb-2">平均能量</div><div class="text-4xl font-bold" id="pedsa-stat-energy">0.00</div></div>
                        <div class="p-6 glass rounded-3xl"><div class="text-sky-400/60 text-[10px] uppercase font-bold mb-2">活跃检索</div><div class="text-4xl font-bold" id="pedsa-stat-queries">0</div></div>
                        <div class="p-6 glass rounded-3xl"><div class="text-sky-400/60 text-[10px] uppercase font-bold mb-2">故事时间</div><div class="text-4xl font-bold" id="pedsa-stat-time">0</div></div>
                    </div>
                    <div class="flex-1 glass rounded-3xl overflow-hidden flex flex-col min-h-[400px]">
                        <div class="p-5 border-b border-white/5 bg-white/5">处理日志喵~</div>
                        <div id="pedsa-log-container" class="flex-1 p-5 overflow-y-auto font-mono text-xs space-y-2 text-sky-200/80"></div>
                    </div>
                </section>

                <!-- 图谱查看 -->
                <section id="pedsa-view-network" class="view-section">
                    <div id="pedsa-graph-container" class="absolute inset-0 z-0"></div>
                    <div class="absolute top-6 left-6 z-10 glass px-4 py-2 rounded-xl border border-sky-400/20">
                        <h2 class="font-bold text-sky-50">记忆拓扑图</h2>
                    </div>
                </section>

                <!-- 事件列表 -->
                <section id="pedsa-view-events" class="view-section">
                    <header class="mb-6">
                        <h2 class="text-2xl font-bold text-sky-50">记忆事件流</h2>
                        <p class="text-sky-400/60 text-sm">记录原始对话与 LLM 维护后的事件摘要</p>
                    </header>
                    <div class="flex-1 overflow-y-auto space-y-4 pr-2" id="pedsa-event-list-container">
                        <div class="text-sky-400/20 text-center py-20 italic glass rounded-2xl">暂无记忆事件喵~</div>
                    </div>
                </section>

                <!-- 系统核心配置 -->
                <section id="pedsa-view-settings" class="view-section">
                    <header class="mb-8">
                        <h2 class="text-2xl font-bold text-sky-50">系统核心配置</h2>
                        <p class="text-sky-400/60 text-sm">调整记忆引擎与 LLM 维护参数</p>
                    </header>
                    <div class="space-y-6">
                        <div class="glass rounded-3xl p-6">
                            <h3 class="text-lg font-bold text-sky-100 mb-6 flex items-center gap-2">
                                <i data-lucide="bot" class="w-5 h-5 text-sky-400"></i>
                                <span>图谱维护 LLM (OpenAI 兼容)</span>
                            </h3>
                            <div class="space-y-4">
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div class="space-y-2">
                                        <label class="text-xs font-bold text-sky-400/70 uppercase">API Endpoint</label>
                                        <input type="text" id="pedsa-setting-llm-endpoint" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:border-sky-400/50 outline-none transition-all" placeholder="https://api.openai.com/v1">
                                    </div>
                                    <div class="space-y-2">
                                        <label class="text-xs font-bold text-sky-400/70 uppercase">Model Name</label>
                                        <input type="text" id="pedsa-setting-llm-model" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:border-sky-400/50 outline-none transition-all" placeholder="gpt-3.5-turbo">
                                    </div>
                                </div>
                                <div class="space-y-2">
                                    <label class="text-xs font-bold text-sky-400/70 uppercase">API Key</label>
                                    <input type="password" id="pedsa-setting-llm-key" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:border-sky-400/50 outline-none transition-all" placeholder="sk-...">
                                </div>
                            </div>
                        </div>
                        <div class="flex justify-end gap-4">
                            <button id="pedsa-save-settings" class="px-8 py-3 bg-sky-500 hover:bg-sky-400 text-white rounded-xl font-bold transition-all shadow-lg shadow-sky-500/20">保存配置喵！</button>
                        </div>
                    </div>
                </section>
            </main>
        `;

        document.body.appendChild(this.overlay);

        // 绑定事件喵~
        this.overlay.querySelectorAll('.nav-item').forEach(btn => {
            btn.onclick = () => this._switchView(btn.dataset.view);
        });

        this.overlay.querySelector('#pedsa-close-btn').onclick = () => this.render();

        // 绑定设置保存喵~
        this.overlay.querySelector('#pedsa-save-settings').onclick = () => {
            const settings = {
                llm: {
                    endpoint: this.overlay.querySelector('#pedsa-setting-llm-endpoint').value,
                    model: this.overlay.querySelector('#pedsa-setting-llm-model').value,
                    key: this.overlay.querySelector('#pedsa-setting-llm-key').value
                }
            };
            this.parent.dashboard.updateSettings(settings);
            alert('配置已保存喵！');
        };
    }

    _switchView(viewId) {
        this.activeView = viewId;
        this.overlay.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
        this.overlay.querySelector(`#pedsa-view-${viewId}`).classList.add('active');
        
        this.overlay.querySelectorAll('.nav-item').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === viewId);
        });

        if (viewId === 'network') {
            this._renderGraph();
        }

        // 切换到设置页时填充当前值喵~
        if (viewId === 'settings' && this.parent.dashboard) {
            const current = this.parent.dashboard.settings;
            if (current && current.llm) {
                this.overlay.querySelector('#pedsa-setting-llm-endpoint').value = current.llm.endpoint || '';
                this.overlay.querySelector('#pedsa-setting-llm-model').value = current.llm.model || '';
                this.overlay.querySelector('#pedsa-setting-llm-key').value = current.llm.key || '';
            }
        }
    }

    updateUI() {
        if (!this.isInitialized || !this.parent.dashboard) return;
        const state = this.parent.dashboard.getSnapshot();
        
        // 更新统计喵~
        const elNodes = this.overlay.querySelector('#pedsa-stat-nodes');
        const elEnergy = this.overlay.querySelector('#pedsa-stat-energy');
        const elQueries = this.overlay.querySelector('#pedsa-stat-queries');
        const elTime = this.overlay.querySelector('#pedsa-stat-time');

        if (elNodes) elNodes.textContent = state.stats.nodes;
        if (elEnergy) elEnergy.textContent = state.stats.avgEnergy.toFixed(2);
        if (elQueries) elQueries.textContent = state.stats.activeQueries;
        if (elTime) elTime.textContent = state.stats.storyTime;

        // 更新日志喵~
        const logContainer = this.overlay.querySelector('#pedsa-log-container');
        if (logContainer && state.logs) {
            logContainer.innerHTML = state.logs.map(log => `
                <div class="flex gap-2">
                    <span class="text-sky-500/50 text-[10px]">[${new Date(log.timestamp).toLocaleTimeString()}]</span>
                    <span class="${log.type === 'error' ? 'text-red-400' : 'text-sky-200'}">${log.message}</span>
                </div>
            `).join('');
            logContainer.scrollTop = logContainer.scrollHeight;
        }

        // 更新事件列表喵~
        const eventContainer = this.overlay.querySelector('#pedsa-event-list-container');
        if (eventContainer && state.events && state.events.length > 0) {
            eventContainer.innerHTML = state.events.map(ev => `
                <div class="glass p-5 rounded-2xl border border-white/5 hover:border-sky-500/20 transition-all">
                    <div class="flex justify-between items-start mb-3">
                        <span class="px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-400 text-[10px] font-bold uppercase tracking-wider">${ev.type}</span>
                        <span class="text-[10px] text-sky-500/40 mono">${new Date(ev.timestamp).toLocaleString()}</span>
                    </div>
                    <div class="text-sm text-sky-50 font-medium mb-2">${ev.summary || ev.content}</div>
                    <div class="flex flex-wrap gap-2">
                        ${(ev.keywords || []).map(k => `<span class="text-[9px] px-2 py-0.5 rounded bg-white/5 text-sky-300/60 border border-white/5">#${k}</span>`).join('')}
                    </div>
                </div>
            `).reverse().join('');
        }

        this.state = state;
    }

    _renderGraph() {
        const container = this.overlay.querySelector('#pedsa-graph-container');
        if (!container || !window.ForceGraph || !this.state) return;

        if (!this.graph) {
            this.graph = window.ForceGraph()(container)
                .backgroundColor('#020617')
                .linkColor(() => 'rgba(56, 189, 248, 0.2)')
                .nodeLabel('name')
                .nodeColor(node => node.type === 'keyword' ? '#38bdf8' : '#f472b6')
                .nodeVal(node => (node.energy || 1) * 2);
        }

        // 转换数据格式喵~
        const graphData = {
            nodes: this.state.graph.nodes,
            links: this.state.graph.links
        };
        this.graph.graphData(graphData);
    }
}

class PEDSA {
        constructor() {
            console.log('[PEDSA] 正在初始化核心系统 (单页注入模式)... 喵~');
            this.engine = new GraphEngine();
            this.matcher = new KeywordMatcher();
            this.dashboard = new DashboardManager(this.engine, this.matcher);
            this.tavern = new TavernIntegration(this.engine, this.dashboard, this.matcher);
            this.ui = new PEDSAUI(this);

            this.dashboard.onUpdate = (type, data) => {
                this._broadcastSnapshot();
            };
            this.dashboard.onSettingsUpdate = (settings) => {
                this.tavern.updateSettings(settings);
            };

            this._initTavernEvents();
            setInterval(() => this._broadcastSnapshot(), 5000);
            this._injectExtensionPageButton();
            console.log('[PEDSA] 系统初始化完成！喵呜~');
        }

        _initTavernEvents() {
            const tryInit = () => {
                if (typeof window === 'undefined' || !window.SillyTavern) return false;
                const context = window.SillyTavern.getContext();
                if (!context || !context.eventSource) return false;
                context.eventSource.on('chat_changed', () => {
                    console.log('[PEDSA] 检测到聊天切换，正在重置引擎...喵~');
                    this.engine = new GraphEngine(); 
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

        _injectExtensionPageButton() {
            if (typeof document === 'undefined') return;
            console.log('[PEDSA] 启动扩展页注入监听... 喵~');
            const injectAction = () => {
                if (document.getElementById('pedsa-extension-btn')) return true;
                let container = document.querySelector('#extensions_settings') || 
                                 document.querySelector('#extensions-settings') ||
                                 document.querySelector('#extensions_list') ||
                                 document.querySelector('#extensions-container') ||
                                 document.querySelector('.extensions-settings') ||
                                 document.querySelector('#extension_settings') ||
                                 document.querySelector('#extensionsMenu') ||
                                 document.querySelector('.extension-list') ||
                                 document.querySelector('#extensions_view');
                if (!container) {
                    const headers = Array.from(document.querySelectorAll('h3, h4, .panel-header'));
                    const extHeader = headers.find(h => h.innerText.includes('Extensions') || h.innerText.includes('扩展'));
                    if (extHeader && extHeader.parentElement) {
                        container = extHeader.parentElement;
                    }
                }
                if (!container) {
                    this._injectAttempts = (this._injectAttempts || 0) + 1;
                    if (this._injectAttempts % 10 === 0) {
                        console.log('[PEDSA] 正在寻找扩展页容器... 目前还没找到喵~ (已尝试 ' + this._injectAttempts + ' 次)');
                    }
                    return false;
                }
                console.log('[PEDSA] 发现扩展页容器:', container.id || container.className || 'unknown', '正在注入按钮... 喵~');
                const entry = document.createElement('div');
                entry.id = 'pedsa-extension-btn';
                entry.className = 'extension_button interactable';
                entry.setAttribute('role', 'button');
                entry.style.cssText = `
                    display: flex;
                    align-items: center;
                    padding: 12px 16px;
                    margin: 10px 0;
                    background: rgba(56, 189, 248, 0.1);
                    border: 1px solid rgba(56, 189, 248, 0.2);
                    border-radius: 12px;
                    cursor: pointer;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    width: calc(100% - 32px);
                    position: relative;
                    z-index: 10;
                `;
                entry.onmouseenter = () => {
                    entry.style.background = 'rgba(56, 189, 248, 0.15)';
                    entry.style.borderColor = 'rgba(56, 189, 248, 0.4)';
                    entry.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
                };
                entry.onmouseleave = () => {
                    entry.style.background = 'rgba(56, 189, 248, 0.1)';
                    entry.style.borderColor = 'rgba(56, 189, 248, 0.2)';
                    entry.style.boxShadow = 'none';
                };
                const icon = document.createElement('i');
                icon.className = 'fa-solid fa-brain fa-fw';
                icon.style.cssText = `
                    margin-right: 15px;
                    color: #38bdf8;
                    font-size: 1.4em;
                    filter: drop-shadow(0 0 5px rgba(56, 189, 248, 0.5));
                `;
                const textContainer = document.createElement('div');
                textContainer.style.flex = '1';
                const label = document.createElement('div');
                label.innerText = 'PEDSA 记忆拓扑';
                label.style.fontWeight = 'bold';
                label.style.color = '#f8fafc';
                label.style.fontSize = '1.05em';
                const desc = document.createElement('div');
                desc.innerText = '实时扩散渲染 & 语义共鸣分析喵~';
                desc.style.fontSize = '0.85em';
                desc.style.color = '#94a3b8';
                desc.style.marginTop = '2px';
                textContainer.appendChild(label);
                textContainer.appendChild(desc);
                entry.appendChild(icon);
                entry.appendChild(textContainer);
                const arrow = document.createElement('i');
                arrow.className = 'fa-solid fa-chevron-right';
                arrow.style.cssText = `
                    color: #475569;
                    font-size: 0.9em;
                    margin-left: 10px;
                `;
                entry.appendChild(arrow);
                entry.onclick = (e) => {
                    console.log('[PEDSA] 按钮被点击了喵！');
                    e.preventDefault();
                    e.stopPropagation();
                    this.toggleDashboard();
                };
                container.prepend(entry);
                console.log('[PEDSA] 扩展页按钮注入成功！喵~');
                return true;
            };
            injectAction();
            const observer = new MutationObserver((mutations) => {
                if (!document.getElementById('pedsa-extension-btn')) {
                    injectAction();
                }
            });
            observer.observe(document.documentElement, {
                childList: true,
                subtree: true
            });
            setInterval(() => {
                if (!document.getElementById('pedsa-extension-btn')) {
                    injectAction();
                }
            }, 1000);
        }

        toggleDashboard() {
            this.ui.render();
        }

        _broadcastSnapshot() {
            if (this.ui && this.ui.isInitialized) {
                this.ui.updateUI();
            }
        }
    }

    // 初始化入口
    if (typeof document !== 'undefined') {
        const runInit = () => {
            if (typeof window !== 'undefined' && !window.pedsa) {
                window.pedsa = new PEDSA();
            }
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', runInit);
        } else {
            runInit();
        }
    }

})();
