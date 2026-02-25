/**
 * OntologyManager - 本体与记忆管理器
 * 
 * 负责解析符合《图谱构建提示词》规范的 JSON 数据，并驱动 GraphEngine 进行增量更新。
 */

const SimHash = require('./SimHash');
const Stopwords = require('./Stopwords');

class OntologyManager {
    // 情感映射表 (8位 Affective 维度 - 使用位旗标喵~)
    static EMOTION_MAP = {
        'JOY': 1n << 0n,
        'SHY': 1n << 1n,
        'FEAR': 1n << 2n,
        'SURPRISE': 1n << 3n,
        'SADNESS': 1n << 4n,
        'DISGUST': 1n << 5n,
        'ANGER': 1n << 6n,
        'ANTICIPATION': 1n << 7n
    };

    // 实体类型映射表 (8位 Entity 维度 - 使用位旗标喵~)
    static TYPE_MAP = {
        'PERSON': 1n << 0n,
        'TECH': 1n << 1n,
        'EVENT': 1n << 2n,
        'LOCATION': 1n << 3n,
        'OBJECT': 1n << 4n,
        'VALUES': 1n << 5n
    };

    /**
     * @param {GraphEngine} engine 
     * @param {KeywordMatcher} matcher 
     */
    constructor(engine, matcher) {
        this.engine = engine;
        this.matcher = matcher;
        
        // 引用静态映射表
        this.emotionMap = OntologyManager.EMOTION_MAP;
        this.typeMap = OntologyManager.TYPE_MAP;
    }

    /**
     * 处理 LLM 输出的增量指令
     * @param {Object} data - 符合提示词规范的 JSON 对象
     */
    applyUpdate(data) {
        const { new_event, ontology_updates } = data;

        // 1. 更新 Ontology (本体定义库)
        if (ontology_updates) {
            for (const update of ontology_updates) {
                this._handleOntologyUpdate(update);
            }
        }

        // 2. 插入新事件 (记忆节点)
        if (new_event) {
            this._handleNewEvent(new_event);
        }

        // 3. 重新构建关键词匹配器 (因为可能有新的关键词)
        this.matcher.build();
    }

    /**
     * 处理单个本体更新
     */
    _handleOntologyUpdate(update) {
        const { source, target, relation_type, strength } = update;

        // 确保源节点和目标节点存在 (nodeType = 0 为本体节点)
        // 如果包含停用词，则跳过此关联
        if (!this._ensureOntologyNode(source)) return;
        if (!this._ensureOntologyNode(target)) return;

        // 添加边喵~
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
        
        // 如果是等价关系，添加双向边
        if (relation_type === 'equality') {
            this.engine.addEdge(target, source, finalWeight, finalType);
        }

        // 注册到关键词匹配器
        this.matcher.register(source, source);
        this.matcher.register(target, target);
    }

    /**
     * 处理新事件插入
     */
    _handleNewEvent(event) {
        const { summary, features, type, emotion, time, raw } = event;
        
        // 使用剧情时钟作为唯一的时间锚点
        const storyTimestamp = this.engine.storyTime;
        
        // 生成事件 ID
        const eventId = `event_${storyTimestamp}_${Math.floor(Math.random() * 1000)}`;

        // 构建事件的 SimHash
        // 注意：temporal 维度使用 LLM 返回的准确故事天数 (time)，以支持相对时间匹配
        const simhash = SimHash.build({
            affective: this.emotionMap[emotion] || 0n,
            entity: this.typeMap[type] || 0n,
            temporal: BigInt(time !== undefined ? time : storyTimestamp),
            semantic: BigInt(this._simpleHash(summary))
        });

        // 添加事件节点 (nodeType = 1)
        this.engine.addNode({
            id: eventId,
            name: summary,
            nodeType: 1,
            simhash: simhash.value,
            timestamp: storyTimestamp, // 存储创建时的剧情时钟刻度
            storyDay: time !== undefined ? time : storyTimestamp, // 存储 LLM 推算的故事天数喵~
            category: type, // 存储原始类别喵~
            sentiment: emotion, // 存储原始情绪喵~
            raw: raw, // 存储原始文本喵~
            features: features // 存储特征列表喵~
        });

        // 将事件连接到提取出的特征节点
        if (features) {
            for (const feature of features) {
                // 如果是停用词，跳过喵~
                if (!this._ensureOntologyNode(feature)) continue;
                
                // 核心连接：特征 -> 事件
                this.engine.addEdge(feature, eventId, 1.0, 'representation');
                // 反向连接：事件 -> 特征 (用于双向联想)
                this.engine.addEdge(eventId, feature, 0.5, 'representation');
                // 注册关键词
                this.matcher.register(feature, feature);
            }
        }
    }

    /**
     * 确保本体节点存在
     */
    _ensureOntologyNode(name) {
        // 1. 停用词过滤 (深度净化)
        if (Stopwords.has(name) || name.length < 1) {
            return false;
        }

        // 2. 确保节点存在
        if (!this.engine.nodes.has(name)) {
            this.engine.addNode({
                id: name,
                name: name,
                nodeType: 0,
                // 本体节点的 SimHash 可以根据名称生成
                simhash: SimHash.build({ semantic: BigInt(this._simpleHash(name)) }).value
            });
        }
        return true;
    }

    /**
     * 简单的字符串哈希，用于填充 SimHash 的语义维度
     */
    _simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash);
    }
}

module.exports = OntologyManager;
