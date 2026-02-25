/**
 * KeywordMatcher - 关键词提取与匹配器
 * 
 * 模拟 PEDSA 的特征提取层。
 * 用于从文本中识别“本体 (Ontology)”节点并赋予初始能量。
 */

const AhoCorasick = require('./AhoCorasick');

class KeywordMatcher {
    constructor() {
        this.ac = new AhoCorasick();
        this.definitions = []; // 暂存定义以支持重新排序构建喵~
        this.isBuilt = false;
    }

    /**
     * 注册关键词与节点的映射
     * @param {string} keyword 
     * @param {string} nodeId 
     */
    register(keyword, nodeId) {
        this.definitions.push({ keyword: keyword.toLowerCase(), nodeId });
        this.isBuilt = false;
    }

    /**
     * 构建 AC 自动机
     */
    build() {
        // V2 优化：按长度降序排序，确保长词优先匹配喵~
        this.definitions.sort((a, b) => b.keyword.length - a.keyword.length);
        
        // 重置 AC 自动机
        this.ac = new AhoCorasick();
        for (const def of this.definitions) {
            this.ac.addPattern(def.keyword, def.nodeId);
        }
        
        this.ac.build();
        this.isBuilt = true;
    }

    /**
     * 从文本中提取激活节点
     * @param {string} text 
     * @returns {Map<string, number>} nodeId -> initialEnergy
     */
    match(text) {
        if (!this.isBuilt) this.build();
        
        const activations = new Map();
        const lowerText = text.toLowerCase();
        
        const matches = this.ac.search(lowerText);
        
        // V2 优化：处理重叠匹配，确保长词优先且不重复赋予能量喵~
        // 按结束位置升序，长度降序排序
        matches.sort((a, b) => {
            if (a.endPos !== b.endPos) return a.endPos - b.endPos;
            return b.length - a.length;
        });

        // 用于记录哪些字符位置已经被占用了
        const covered = new Array(text.length).fill(false);

        for (const match of matches) {
            const startPos = match.endPos - match.length + 1;
            
            // 检查该匹配范围是否已被更长的词覆盖
            let isCovered = false;
            for (let i = startPos; i <= match.endPos; i++) {
                if (covered[i]) {
                    isCovered = true;
                    break;
                }
            }

            if (!isCovered) {
                // 标记覆盖
                for (let i = startPos; i <= match.endPos; i++) {
                    covered[i] = true;
                }

                // 命中关键词，赋予初始能量 1.0
                const nodeId = match.data;
                const currentEnergy = activations.get(nodeId) || 0;
                activations.set(nodeId, Math.min(2.0, currentEnergy + 1.0));
            }
        }

        return activations;
    }

    /**
     * 批量加载本体定义
     * @param {Array} definitions - [{ keyword, nodeId }]
     */
    loadDefinitions(definitions) {
        for (let def of definitions) {
            this.register(def.keyword, def.nodeId);
        }
    }
}

module.exports = KeywordMatcher;
