/**
 * TavernIntegration - 酒馆事件集成与对话总结逻辑
 * 
 * 负责监听 SillyTavern 的消息事件，缓冲对话内容，并根据配置触发 LLM 总结。
 * 同时也负责调用 LLM API 进行图谱构建与事件记录。
 */

const QueryGenerator = require('./QueryGenerator');
const OntologyManager = require('./OntologyManager');

class TavernIntegration {
    /**
     * @param {GraphEngine} engine 
     * @param {DashboardManager} dashboard 
     * @param {KeywordMatcher} matcher
     * @param {Object} ontologyMaps - { emotionMap, typeMap }
     */
    constructor(engine, dashboard, matcher, ontologyMaps) {
        this.engine = engine;
        this.dashboard = dashboard;
        this.matcher = matcher;
        
        // 如果未提供映射表，则从 OntologyManager 获取默认值喵~
        const maps = ontologyMaps || {
            emotionMap: OntologyManager.EMOTION_MAP,
            typeMap: OntologyManager.TYPE_MAP
        };

        // 初始化共鸣指纹生成器
        this.queryGenerator = new QueryGenerator(engine, matcher, maps);

        // 初始化本体管理器喵~
        this.ontologyManager = new OntologyManager(engine, matcher);
        
        this.messageBuffer = [];
        this.settings = {
            enabled: true,
            endpoint: '',
            key: '',
            model: 'gpt-3.5-turbo',
            frequency: 5, // 每 5 轮对话总结一次
            depth: 0      // 记忆注入深度
        };
        this.roundCounter = 0;
        
        // 检索上下文缓冲 (用于指纹继承)
        this.lastContext = {
            emotion: 'JOY', // 默认情感
            type: 'PERSON'  // 默认实体类型
        };
        
        // 存储最近一次唤醒的记忆文本喵~
        this.lastRecalledMemory = null;
        
        // 绑定事件
        this._initEvents();
    }

    /**
     * 更新配置
     */
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        this.dashboard.log('INF', `[TavernIntegration] 配置已更新: ${this.settings.model} (每 ${this.settings.frequency} 轮总结)`);
    }

    /**
     * 初始化酒馆事件监听
     */
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

                // 监听消息发送与接收
                eventSource.on('message_sent', (payload) => this._handleMessage('user', payload));
                eventSource.on('message_received', (payload) => this._handleMessage('char', payload));
                
                // 监听消息删除（用于撤回同步）
                eventSource.on('message_deleted', (payload) => this._handleRecall(payload));

                // 监听生成开始事件，准备注入记忆喵~
                eventSource.on('gen_starting', () => this._injectMemoryToPrompt());

                this.dashboard.log('INF', '[TavernIntegration] 酒馆事件监听已启动喵~');
                return true;
            } catch (err) {
                console.error('[PEDSA-ST] 初始化酒馆事件监听失败:', err);
                return false;
            }
        };

        if (!tryInit()) {
            // 如果失败，每隔 1 秒重试一次，最多 10 次
            let retries = 0;
            const interval = setInterval(() => {
                retries++;
                if (tryInit() || retries > 10) {
                    clearInterval(interval);
                    if (retries > 10) {
                        console.warn('[PEDSA-ST] 酒馆事件监听初始化超时，请检查 SillyTavern 环境喵~');
                    }
                }
            }, 1000);
        }
    }

    /**
     * 处理新消息
     * @param {'user' | 'char'} role 
     * @param {any} messageId - SillyTavern 传递的消息索引号
     */
    async _handleMessage(role, messageId) {
        // 如果插件被禁用，跳过处理喵~
        if (this.settings.enabled === false) return;

        // SillyTavern 的事件 payload 是消息在 chat 数组中的索引号喵~
        let content = '';
        try {
            if (typeof window !== 'undefined' && window.SillyTavern) {
                const context = window.SillyTavern.getContext();
                const msg = context.chat[messageId];
                if (msg && msg.mes) {
                    content = msg.mes;
                }
            }
        } catch (e) {
            console.warn('[PEDSA-ST] 获取消息内容失败:', e);
        }
        
        // 兼容：如果 messageId 本身就是字符串，直接使用
        if (!content && typeof messageId === 'string' && messageId.length > 0) {
            content = messageId;
        }
        // 兼容：如果 messageId 是包含 mes 的对象
        if (!content && typeof messageId === 'object' && messageId !== null && messageId.mes) {
            content = messageId.mes;
        }
        
        if (!content) return;

        // --- PEDSA 实时检索逻辑 (仅当用户说话时) ---
        if (role === 'user') {
            this.dashboard.log('INF', `[PEDSA-ST] 正在检索共鸣记忆: "${content.substring(0, 20)}..."`);
            
            // 1. 产生共鸣指纹 (Query SimHash)
            const querySimHash = this.queryGenerator.generate(content, this.lastContext);
            
            // 2. 匹配关键词并注入初始能量
            const initialActivations = this.matcher.match(content);
            
            // 3. 执行激活扩散 (Spreading Activation)
            // 扩散过程中会利用 querySimHash 进行维度共鸣加成
            const activatedEvents = this.engine.diffuse(initialActivations, {
                querySimHash: querySimHash.value // 传入指纹进行共鸣
            });

            const topK = this.settings.topK || 1;

            if (activatedEvents.length > 0) {
                // 取出前 K 个相关记忆
                const topEvents = activatedEvents.slice(0, topK);
                // 存储最近一次唤醒的记忆列表喵~
                this.lastRecalledMemories = topEvents.map(e => e.name); 
                
                const topEvent = topEvents[0];
                this.dashboard.log('INF', `[PEDSA-ST] 唤醒最高关联记忆: "${topEvent.name}" (共鸣分: ${topEvent.energy.toFixed(2)}, 共唤醒 ${topEvents.length} 条)`);
                
                // 更新仪表盘的共鸣维度数据喵~
                this.dashboard.updateResonance(querySimHash.value, topEvent.simhash);
            } else {
                this.lastRecalledMemories = []; // 没有匹配到相关记忆
                // 如果没有匹配到，也可以更新一下指纹，显示当前检索的倾向喵~
                this.dashboard.updateResonance(querySimHash.value, querySimHash.value);
            }
        }

        // 添加到缓冲区
        this.messageBuffer.push({ role, content, time: new Date().toISOString() });
        
        // 如果是角色回复，则计数器加 1 (一轮完整对话 = 用户说 + 角色回)
        if (role === 'char') {
            this.roundCounter++;
            this.dashboard.log('INF', `[TavernIntegration] 对话轮次: ${this.roundCounter}/${this.settings.frequency}`);
            
            // 达到触发阈值
            if (this.roundCounter >= this.settings.frequency) {
                await this._triggerSummary();
                this.roundCounter = 0;
                this.messageBuffer = []; // 清空缓冲区
            }
        }
    }

    /**
     * 处理消息删除（撤回）
     */
    _handleRecall(payload) {
        this.dashboard.log('INF', `[TavernIntegration] 检测到消息撤回 (ID: ${payload.id || '未知'})，图谱同步功能已就绪`);
    }

    /**
     * 将检索到的记忆注入到酒馆的 Prompt 中喵~
     */
    _injectMemoryToPrompt() {
        if (this.settings.enabled === false || !this.lastRecalledMemories || this.lastRecalledMemories.length === 0) {
            // 如果插件禁用或没有唤醒记忆，清除之前的注入内容
            if (typeof window !== 'undefined' && window.SillyTavern) {
                try {
                    const context = window.SillyTavern.getContext();
                    const depth = this.settings.depth !== undefined ? this.settings.depth : 0;
                    context.setExtensionPrompt('pedsa_memory', '', depth);
                } catch (e) { /* 忽略清除错误 */ }
            }
            return;
        }

        if (typeof window !== 'undefined' && window.SillyTavern) {
            try {
                const context = window.SillyTavern.getContext();
                
                // 构造多条记忆的注入文本
                let memoriesText = '';
                if (this.lastRecalledMemories.length === 1) {
                    memoriesText = this.lastRecalledMemories[0];
                } else {
                    memoriesText = this.lastRecalledMemories.map((m, i) => `[记忆片段 ${i+1}]: ${m}`).join('\n');
                }
                
                const injectionText = `<PEDSA_LONG_MEMORY>\n${memoriesText}\n</PEDSA_LONG_MEMORY>`;
                const depth = this.settings.depth !== undefined ? this.settings.depth : 0;
                
                /**
                 * 注入到 SillyTavern 的 Extension Prompt
                 * 参数 1: 注入标识符
                 * 参数 2: 注入文本
                 * 参数 3: 注入深度 (可配置)
                 */
                context.setExtensionPrompt('pedsa_memory', injectionText, depth);
                
                this.dashboard.log('INF', `[PEDSA-ST] 记忆已注入提示词 (深度: ${depth}): "${this.lastRecalledMemory}" 喵！`);
            } catch (err) {
                console.error('[PEDSA-ST] 注入提示词失败:', err);
            }
        }
    }

    /**
     * 触发 LLM 总结与图谱构建
     */
    async _triggerSummary() {
        if (this.settings.enabled === false) return;

        if (!this.settings.endpoint || !this.settings.key) {
            this.dashboard.log('ERR', '[TavernIntegration] 未配置 LLM API，跳过总结构建');
            return;
        }

        this.dashboard.log('INF', '[TavernIntegration] 正在调用 LLM 进行图谱总结与构建...');

        // 使用酒馆原生 toastr 弹出非模态通知喵~
        if (typeof toastr !== 'undefined') {
            toastr.info('正在调用 LLM 进行图谱总结与构建...', 'PEDSA-ST 图谱构建', {
                timeOut: 4000,
                extendedTimeOut: 2000,
                progressBar: true
            });
        }

        // 拼接对话上下文
        const userMsgs = this.messageBuffer.filter(m => m.role === 'user').map(m => m.content).join('\n');
        const charMsgs = this.messageBuffer.filter(m => m.role === 'char').map(m => m.content).join('\n');

        try {
            const result = await this._callLLM(userMsgs, charMsgs);
            if (result && result.new_event) {
                // 0. 步进剧情时钟 (这是本地逻辑的时间源)
                this.engine.advanceClock(1);
                
                // 1. 更新背景上下文 (用于下一轮检索的指纹继承)
                this.lastContext.emotion = result.new_event.emotion;
                this.lastContext.type = result.new_event.type;

                // 注入原始对话文本喵~
                const rawText = `用户: ${userMsgs.substring(0, 100)}${userMsgs.length > 100 ? '...' : ''} / AI: ${charMsgs.substring(0, 100)}${charMsgs.length > 100 ? '...' : ''}`;
                result.new_event.raw = rawText;

                // 2. 使用本体管理器更新图谱喵~ (处理 new_event 和 ontology_updates)
                this.ontologyManager.applyUpdate(result);

                // 3. 记录到仪表盘喵~
                this.dashboard.addEvent({
                    raw: rawText,
                    summary: result.new_event.summary,
                    type: result.new_event.type,
                    emotion: result.new_event.emotion,
                    time: result.new_event.time,
                    features: result.new_event.features
                });

                // 4. 触发动态剪枝 (防止图谱无限膨胀) 喵~
                this.engine.pruneEdges();

                this.dashboard.log('INF', `[TavernIntegration] 图谱维护完成: ${result.new_event.summary} (剧情时钟: ${this.engine.storyTime})`);

                // 构建成功通知喵~
                if (typeof toastr !== 'undefined') {
                    toastr.success(
                        `${result.new_event.summary}`,
                        `PEDSA-ST 图谱更新 (第 ${this.engine.storyTime} 天)`,
                        { timeOut: 6000, extendedTimeOut: 3000, progressBar: true }
                    );
                }
            }
        } catch (err) {
            this.dashboard.log('ERR', `[TavernIntegration] LLM 调用失败: ${err.message}`);

            // 构建失败通知喵~
            if (typeof toastr !== 'undefined') {
                toastr.error(
                    `LLM 调用失败: ${err.message}`,
                    'PEDSA-ST 图谱构建错误',
                    { timeOut: 8000, extendedTimeOut: 4000, progressBar: true }
                );
            }
        }
    }

    /**
     * 调用 OpenAI 兼容接口
     */
    async _callLLM(userContent, charResponse) {
        const storyDay = this.engine.storyTime;
        
        // 构建完整的提示词 (基于 2. 图谱构建提示词.md)
        const prompt = `# 图谱构建提示词

你是一个专业的知识图谱架构师。你的任务是在每次对话结束后，分析用户对 Pero 的发言，并输出增量的图谱维护指令。

**当前故事天数 (Current Story Day)**: \`第 ${storyDay} 天\`
**对话上下文**:
- **用户**: "${userContent}"
- **AI**: "${charResponse}"

## 1. 核心任务

请从最近的对话中提取并生成以下两部分内容：

### A. 事件节点
将本次对话的核心内容总结为一个独立的事件：
- **Summary**: 简洁的总结，字数控制在 **50个字左右**。
    - **必须以故事天数开头**：格式为"故事第 X 天"。**注意：必须根据 Current Story Day 和对话中的相对时间（如"昨天"、"前天"）推算出该事件发生的准确故事天数。**
    - **内容要素**：包含时间、地点、涉及的人物/事物、起因、结果。
- **Features**: 提取代表本次对话中所涉及事物的"词语"。**注意：这些词语必须与下文中 Ontology 维护的词语保持一致。**
- **Type**: 必须从以下 6 种实体类型中选择 **最匹配的一个**：
    - \`PERSON\` (人物/身份 - 如 Pero, 用户)
    - \`TECH\` (技术/概念 - 如 Rust, PyO3)
    - \`EVENT\` (事件/动作 - 如 跑步, 吃饭)
    - \`LOCATION\` (地点 - 如 上海, 张江)
    - \`OBJECT\` (物件 - 如 蝴蝶结, 键盘)
    - \`VALUES\` (价值观 - 如 伦理, 精神)
- **Emotion**: 必须从以下 8 种情感中选择 **最主导的一个**，禁止输出列表以外的词汇：
    - \`JOY\` (喜悦/快乐)
    - \`SHY\` (害羞/不好意思)
    - \`FEAR\` (恐惧/害怕)
    - \`SURPRISE\` (惊讶/意外)
    - \`SADNESS\` (悲伤/难过)
    - \`DISGUST\` (厌恶/反感)
    - \`ANGER\` (生气/愤怒)
    - \`ANTICIPATION\` (期待/愿景)
- **Time**: 请输出该事件发生的"故事天数"（从故事开始计算的第几天，整数）。**注意：必须是一个基于 Current Story Day 计算出的准确整数。**

### B. Ontology 节点
这是系统的"定义库"，仅用于描述词语的性质和身份。请遵循下述 **"提取原则"**：
- **拆解粒度**: 不要生成冗长的描述性短语，将其拆解为最小意义单元。**但注意：具有整体意义的专有名词（如：品牌、作品名、特定项目、专有术语）严禁原子化拆解**。
- **仅限实词**: 严禁提取"的"、"是"、"了"、"在"、"我"、"你"等虚词、代词或无实际语义的助词。
- **语义聚焦**: 仅提取对理解事件、技术、情感或人物关系有实质贡献的关键词。

连接类型与属性说明：
1.  **relation_type** (核心三种边):
    - \`representation\` (默认): **表征**。
    - \`equality\`: **等价**。用于同义词、缩写、别名。注意，只有**双向等价**关系才能使用该类型，即需要同时满足"A是B"和"B是A"。
    - \`inhibition\`: **抑制**。存在潜在的逻辑冲突时使用。比如"如果某人是蓝发，那么她就不应该是红发。"

2.  **关键属性**:
    - \`strength\` (0.0 - 1.0): 联想强度。

## 2. 输出格式 (JSON Only)
请**只输出**有效的 JSON 字符串，不要包含任何 Markdown 格式：

{
  "new_event": {
    "summary": "故事第 X 天，...",
    "features": ["词语1", "词语2", "..."],
    "type": "PERSON | TECH | EVENT | LOCATION | OBJECT | VALUES",
    "emotion": "JOY | SHY | FEAR | SURPRISE | SADNESS | DISGUST | ANGER | ANTICIPATION",
    "time": number
  },
  "ontology_updates": [
    {
      "source": "词语1",
      "target": "词语2",
      "relation_type": "representation | equality | inhibition",
      "strength": number
    }
  ]
}`;

        const response = await fetch(`${this.settings.endpoint}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.settings.key}`
            },
            body: JSON.stringify({
                model: this.settings.model,
                messages: [{ role: 'user', content: prompt }],
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

module.exports = TavernIntegration;
