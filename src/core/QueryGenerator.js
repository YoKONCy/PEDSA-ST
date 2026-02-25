/**
 * QueryGenerator - 检索指纹生成器
 * 
 * PEDSA 的核心共鸣层：负责在没有 LLM 参与的情况下，
 * 为即时检索消息组装一个高相似度的 SimHash。
 */

const SimHash = require('./SimHash');

class QueryGenerator {
    /**
     * @param {GraphEngine} engine 
     * @param {KeywordMatcher} matcher 
     * @param {Object} maps - { emotionMap, typeMap }
     */
    constructor(engine, matcher, maps) {
        this.engine = engine;
        this.matcher = matcher;
        this.emotionMap = maps.emotionMap;
        this.typeMap = maps.typeMap;
    }

    /**
     * 生成检索指纹
     * @param {string} text - 用户发送的消息
     * @param {Object} context - { emotion, type } 来自 TavernIntegration.lastContext
     * @returns {SimHash}
     */
    generate(text, context) {
        // 1. 匹配关键词并获取它们的预存指纹
        const activations = this.matcher.match(text);
        const matchedHashes = [];

        for (const nodeId of activations.keys()) {
            const node = this.engine.nodes.get(nodeId);
            if (node && node.simhash) {
                matchedHashes.push(new SimHash(node.simhash));
            }
        }

        // 2. 融合关键词指纹 (Bit-Voting)
        let baseHash = SimHash.combine(matchedHashes);

        // 3. 维度覆盖与修补
        // 情感与实体类型
        const affective = this.emotionMap[context.emotion] || 0n;
        const entity = this.typeMap[context.type] || 0n;
        
        // --- 核心改进：本地时间解析器 ---
        let targetStoryTime = BigInt(this.engine.storyTime); // 默认当前时间
        
        const timeRules = [
            // 0. 今天/此刻 (0)
            { regex: /今天|今日|此刻|当前|现在|today|now|current/, offset: 0 },
            
            // 1. 昨天/昨晚 (-1)
            { regex: /昨天|昨日|昨晚|yesterday|last night/, offset: -1 },
            
            // 2. 前天 (-2)
            { regex: /前天|前日|the day before yesterday/, offset: -2 },
            
            // 3. 大前天 (-3)
            { regex: /大前天/, offset: -3 },
            
            // 4. 刚刚 (0)
            { regex: /刚[才刚]|just now/, offset: 0 },
            
            // 5. 最近 (-3)
            { regex: /最近|前些[天日]|recently|lately|a few days ago/, offset: -3 },
            
            // 6. 周期性回溯
            { regex: /上个?星期|上周|last week/, offset: -7 },
            { regex: /上个?月|上月|last month/, offset: -30 },
            { regex: /去年|last year/, offset: -365 },
            
            // 7. 具体数字解析 (支持中文和英文)
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
                break; // 匹配到一个时间词就停止解析
            }
        }

        const temporal = targetStoryTime;

        // 将这些维度合并到 baseHash 中 (利用位运算覆盖对应区域)
        let val = baseHash.value;
        
        // 覆盖 TEMPORAL (32-47位)
        val = (val & ~SimHash.MASKS.TEMPORAL) | ((temporal & 0xFFFFn) << 32n);
        
        // 覆盖 AFFECTIVE (48-55位)
        val = (val & ~SimHash.MASKS.AFFECTIVE) | ((affective & 0xFFn) << 48n);
        
        // 覆盖 ENTITY (56-63位)
        val = (val & ~SimHash.MASKS.ENTITY) | ((entity & 0xFFn) << 56n);

        return new SimHash(val);
    }
}

module.exports = QueryGenerator;
