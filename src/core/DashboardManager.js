/**
 * DashboardManager - 仪表盘数据管理器
 * 
 * 负责收集 GraphEngine 的实时状态并格式化为 Dashboard 所需的 JSON 格式。
 * 提供数据同步机制，支持在浏览器环境中实时更新 UI。
 */

class DashboardManager {
    /**
     * @param {GraphEngine} engine 
     * @param {KeywordMatcher} matcher 
     */
    constructor(engine, matcher) {
        this.engine = engine;
        this.matcher = matcher;
        this.logs = [];
        this.maxLogs = 50;
        this.events = [];
        this.maxEvents = 100;
        this.settings = this._loadSettings();
        
        // 实时共鸣数据喵~
        this.lastResonance = {
            semantic: 0,
            affective: 0,
            entity: 0,
            temporal: 0
        };
        
        // 统计增量喵~
        this.queryCount = 0;
        
        // 注册引擎钩子（如果支持）
        this._setupHooks();
    }

    /**
     * 更新共鸣数据喵~
     */
    updateResonance(queryHash, topNodeHash) {
        if (!queryHash || !topNodeHash) return;
        
        const q = new SimHash(queryHash);
        const t = new SimHash(topNodeHash);
        
        // 计算各维度的匹配度（这里简化为位匹配比例喵~）
        const calculateMatch = (mask, shift, bits) => {
            const v1 = q.getDimension(mask, shift);
            const v2 = t.getDimension(mask, shift);
            
            // 计算汉明距离并归一化
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
        
        // 触发 UI 更新回调喵~
        if (this.onUpdate) this.onUpdate('resonance', this.lastResonance);
    }

    /**
     * 加载配置
     */
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

    /**
     * 保存配置
     */
    saveSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        if (typeof window !== 'undefined' && window.localStorage) {
            localStorage.setItem('pedsa_settings', JSON.stringify(this.settings));
        }
        this.log('INF', '系统配置已保存');
        if (this.onSettingsUpdate) this.onSettingsUpdate(this.settings);
    }

    /**
     * 添加重要事件到列表
     */
    addEvent(event) {
        const fullEvent = {
            id: Date.now().toString(),
            time: new Date().toLocaleString('zh-CN'),
            ...event
        };
        this.events.push(fullEvent);
        if (this.events.length > this.maxEvents) this.events.shift();

        // 触发 UI 更新回调喵~
        if (this.onUpdate) this.onUpdate('event', fullEvent);
    }

    /**
     * 获取当前系统快照
     */
    getSnapshot() {
        const nodes = Array.from(this.engine.nodes.values());
        
        // 展平所有边 (合并本体层和记忆层) 喵~
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
        
        // 计算统计信息喵~
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
                    val: (n.energy * 20) + 5, // 动态调整节点大小喵~
                    color: n.nodeType === 0 ? '#38bdf8' : '#f472b6', // 本体天蓝，事件粉红喵~
                    energy: n.energy,
                    type: n.nodeType,
                    category: n.category, // 新增：对齐 TavernIntegration.js 的类别喵~
                    sentiment: n.sentiment // 新增：事件情绪喵~
                })),
                links: allEdges
            },
            resonance: this.lastResonance,
            logs: this.logs.slice(-20).reverse(),
            events: nodes
                .filter(n => n.nodeType === 1)
                .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)) // 按剧情时钟倒序排列喵~
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

    /**
     * 添加一条日志
     */
    log(type, content) {
        const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });
        const entry = { time, type, content };
        this.logs.push(entry);
        if (this.logs.length > this.maxLogs) this.logs.shift();
        
        // 触发 UI 更新回调喵~
        if (this.onUpdate) this.onUpdate('log', entry);
    }

    /**
     * 导出仪表盘 HTML (作为字符串)
     * 方便在插件环境中直接注入或打开
     */
    async getDashboardHTML() {
        // 这里可以读取 dashboard.html 文件并注入初始数据
        // 在纯 JS 环境下，通常建议通过消息通信
        return ""; 
    }

    _setupHooks() {
        // 可以在这里劫持 engine 的方法来自动记录日志
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

module.exports = DashboardManager;
