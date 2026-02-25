/**
 * GraphEngine - 核心图算法引擎
 * 
 * 实现基于“激活扩散模型 (Spreading Activation)”的记忆检索。
 */

const SimHash = require('./SimHash');

class GraphEngine {
    constructor() {
        this.nodes = new Map(); // id -> node
        this.edges = new Map(); // 废弃：改用双层图谱喵~
        
        // --- V3: 双层图谱隔离 ---
        this.ontologyEdges = new Map(); // fromId -> [{ toId, weight, type }] (本体定义库)
        this.memoryEdges = new Map();   // fromId -> [{ toId, weight, type }] (记忆存储库)
        
        // --- V2: 多维索引桶 ---
        this.temporalIndex = new Map(); // storyDay -> [nodeId]
        this.affectiveIndex = new Map(); // emotionBit -> [nodeId]
        this.inDegrees = new Map();      // nodeId -> count (用于反向抑制)

        // --- V3: 动态剪枝配置喵~ ---
        this.MAX_EDGES_PER_NODE = 100;    // 每个节点最大边数
        this.PRUNE_THRESHOLD = 0.1;       // 自动剪枝权重阈值

        // --- V3: 时间骨架 (Temporal Backbone) 喵~ ---
        this.eventChronology = [];       // 按顺序存储的事件 ID 列表

        // PEDSA 剧情时钟 (解耦现实时间)
        // 初始值为 0，随着对话总结轮次累加
        this.storyTime = 0;
    }

    /**
     * 步进剧情时钟
     * @param {number} delta - 增加的步数 (默认 1 轮)
     */
    advanceClock(delta = 1) {
        this.storyTime += delta;
    }

    /**
     * 添加节点
     * @param {Object} node 
     */
    addNode(node) {
        this.nodes.set(node.id, {
            ...node,
            energy: 0, // 运行时激活能量
        });

        // 维护索引喵~
        if (node.nodeType === 1) { // 仅对 Event 节点建立索引
            // 1. 时间索引
            if (node.storyDay !== undefined) {
                if (!this.temporalIndex.has(node.storyDay)) {
                    this.temporalIndex.set(node.storyDay, []);
                }
                this.temporalIndex.get(node.storyDay).push(node.id);
            }

            // 2. 情感索引 (通过 SimHash 提取)
            if (node.simhash) {
                const s = new SimHash(node.simhash);
                const aff = s.getDimension(SimHash.MASKS.AFFECTIVE, 48);
                if (aff > 0n) {
                    // 支持 8 个情感位 (1<<0 到 1<<7)
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

            // 3. 维护时间骨架 (Temporal Backbone) 喵~
            if (this.eventChronology.length > 0) {
                const prevEventId = this.eventChronology[this.eventChronology.length - 1];
                // 建立双向时序边：前一个事件 -> 当前事件 (顺叙)
                this.addEdge(prevEventId, node.id, 0.8, 'temporal_sequence');
                // 建立反向时序边：当前事件 -> 前一个事件 (倒叙联想)
                this.addEdge(node.id, prevEventId, 0.5, 'temporal_sequence');
            }
            this.eventChronology.push(node.id);
        }
    }

    /**
     * 添加边
     * @param {string} fromId 
     * @param {string} toId 
     * @param {number} weight - 初始权重 (0.0 - 1.0)
     * @param {string} type - 边类型 (SimHash.EDGE_TYPES)
     */
    addEdge(fromId, toId, weight = 1.0, type = SimHash.EDGE_TYPES.REPRESENTATION) {
        const fromNode = this.nodes.get(fromId);
        const toNode = this.nodes.get(toId);
        
        // 自动路由到正确的图谱层喵~
        const targetMap = (fromNode?.nodeType === 0 && toNode?.nodeType === 0) 
            ? this.ontologyEdges 
            : this.memoryEdges;

        if (!targetMap.has(fromId)) {
            targetMap.set(fromId, []);
        }
        
        const edges = targetMap.get(fromId);
        const existingEdge = edges.find(e => e.toId === toId);

        if (existingEdge) {
            // Hebbian Learning (赫布学习): 被动强化机制喵~
            existingEdge.weight = Math.min(1.0, existingEdge.weight + (weight * 0.5));

            if (type === SimHash.EDGE_TYPES.EQUALITY || type === SimHash.EDGE_TYPES.INHIBITION) {
                existingEdge.type = type;
            }
        } else {
            // 动态剪枝：如果边数超限，移除权重最低的边喵~
            if (edges.length >= this.MAX_EDGES_PER_NODE) {
                let minIdx = -1;
                let minWeight = Infinity;
                for (let i = 0; i < edges.length; i++) {
                    if (edges[i].weight < minWeight) {
                        minWeight = edges[i].weight;
                        minIdx = i;
                    }
                }
                if (minIdx !== -1) {
                    const removed = edges.splice(minIdx, 1)[0];
                    // 维护入度
                    this.inDegrees.set(removed.toId, Math.max(0, (this.inDegrees.get(removed.toId) || 1) - 1));
                }
            }

            edges.push({ toId, weight, type });
            // 维护入度统计喵~
            this.inDegrees.set(toId, (this.inDegrees.get(toId) || 0) + 1);
        }
    }

    /**
     * 全局动态剪枝喵~
     * 移除所有权重低于阈值的弱关联。
     */
    pruneEdges() {
        const pruneFromMap = (map) => {
            let removedCount = 0;
            for (const [fromId, edges] of map.entries()) {
                const filtered = edges.filter(e => {
                    if (e.weight < this.PRUNE_THRESHOLD) {
                        this.inDegrees.set(e.toId, Math.max(0, (this.inDegrees.get(e.toId) || 1) - 1));
                        removedCount++;
                        return false;
                    }
                    return true;
                });
                map.set(fromId, filtered);
            }
            return removedCount;
        };

        const removedOntology = pruneFromMap(this.ontologyEdges);
        const removedMemory = pruneFromMap(this.memoryEdges);
        
        if (removedOntology + removedMemory > 0) {
            console.log(`[PEDSA-ST] 动态剪枝完成，共移除 ${removedOntology + removedMemory} 条弱关联边喵~`);
        }
    }

    /**
     * 激活扩散算法 (Spreading Activation V3.5 - Two Tier)
     * 模拟 PEDSA 的双层图谱隔离扩散逻辑喵~
     * @param {Map<string, number>} initialActivations - 初始激活节点及其能量
     * @param {Object} options 
     */
    diffuse(initialActivations, options = {}) {
        const {
            decay = 0.85,          // 扩散衰减系数
            threshold = 0.05,      // 能量剪枝阈值
            ontologySteps = 2,     // 本体层扩散步数
            memorySteps = 1,       // 记忆层扩散步数
            layerLimit = 5000,     // 记忆种子上限 (Lateral Inhibition)
            maxTotalEnergy = 10.0, // 能量归一化上限
            querySimHash = null
        } = options;

        // 0. 重置所有节点能量
        for (let node of this.nodes.values()) node.energy = 0;

        const queryHashObj = querySimHash ? new SimHash(querySimHash) : null;
        let activatedKeywords = new Map(initialActivations);

        // --- Step 1: 多维索引召回 (快速扩充初始集合) ---
        if (queryHashObj) {
            // 1.1 时间共振召回
            const qTime = Number(queryHashObj.getDimension(SimHash.MASKS.TEMPORAL, 32));
            if (qTime > 0 && this.temporalIndex.has(qTime)) {
                for (const nodeId of this.temporalIndex.get(qTime)) {
                    const current = activatedKeywords.get(nodeId) || 0;
                    activatedKeywords.set(nodeId, Math.max(current, 0.6));
                }
            }

            // 1.2 情感共鸣召回
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

        // --- Step 2: 第一数据库 (Ontology 本体库) 扩散 ---
        let ontologyLayer = new Map(activatedKeywords);
        for (let step = 0; step < ontologySteps; step++) {
            const nextOntologyLayer = new Map();
            for (let [sourceId, score] of ontologyLayer) {
                const neighbors = this.ontologyEdges.get(sourceId) || [];
                for (const edge of neighbors) {
                    // 反向抑制
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
            // 合并到当前层
            for (let [id, energy] of nextOntologyLayer) {
                ontologyLayer.set(id, Math.max(ontologyLayer.get(id) || 0, energy));
            }
        }

        // --- Step 3: 能量归一化 (Energy Normalization) ---
        let totalOntologyEnergy = 0;
        for (let e of ontologyLayer.values()) if (e > 0) totalOntologyEnergy += e;
        if (totalOntologyEnergy > maxTotalEnergy) {
            const factor = maxTotalEnergy / totalOntologyEnergy;
            for (let [id, e] of ontologyLayer) ontologyLayer.set(id, e * factor);
        }

        // --- Step 4: 第二数据库 (Memory 记忆库) 扩散 ---
        // 侧向抑制：选出能量最高的种子进行扩散
        let seeds = Array.from(ontologyLayer.entries())
            .filter(e => e[1] > threshold)
            .sort((a, b) => b[1] - a[1]);
        
        if (seeds.length > layerLimit) seeds = seeds.slice(0, layerLimit);
        
        // 初始化最终得分 Map
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

                    // 反向抑制 (Memory 层)
                    const inDegree = this.inDegrees.get(edge.toId) || 1;
                    const inhibitionFactor = 1.0 / (1.0 + Math.log10(inDegree));

                    // 维度共鸣
                    let resonanceBoost = 1.0;
                    if (sourceNode?.simhash && targetNode.simhash) {
                        const s1 = new SimHash(sourceNode.simhash);
                        const s2 = new SimHash(targetNode.simhash);
                        // 情感共鸣
                        if (SimHash.bitwiseMatch(s1, s2, SimHash.MASKS.AFFECTIVE)) resonanceBoost += 0.3;
                        // 时间共鸣 (如果故事日期相同)
                        if (sourceNode.storyDay !== undefined && targetNode.storyDay !== undefined && sourceNode.storyDay === targetNode.storyDay) {
                            resonanceBoost += 0.2;
                        }
                    }

                    // 查询共鸣 (如果提供了检索指纹)
                    if (queryHashObj && targetNode.simhash) {
                        const tHash = new SimHash(targetNode.simhash);
                        // 语义相似度加权
                        const semSim = queryHashObj.similarityWeighted(tHash, SimHash.MASKS.SEMANTIC);
                        resonanceBoost += semSim * 0.5;
                    }

                    let energy = score * edge.weight * decay * inhibitionFactor * resonanceBoost;
                    if (energy > threshold * 0.5) { // Memory 层阈值稍低
                        const current = nextMemoryLayer.get(edge.toId) || 0;
                        nextMemoryLayer.set(edge.toId, current + energy);
                    }
                }
            }
            // 合并到最终得分
            for (let [id, energy] of nextMemoryLayer) {
                finalScores.set(id, (finalScores.get(id) || 0) + energy);
                memoryLayer = nextMemoryLayer;
            }
        }

        // 更新全局节点能量
        for (let [id, energy] of finalScores) {
            const node = this.nodes.get(id);
            if (node) node.energy = energy;
        }

        // --- Step 5: 结果整合与多维对齐重排序 (Multi-modal Refinement) ---
        const candidates = Array.from(this.nodes.values())
            .filter(node => node.nodeType === 1 && node.energy > 0);

        // 如果没有候选者，直接返回空喵~
        if (candidates.length === 0) return [];

        // 仅对 Top 50 候选者进行精细重排序 (按初始能量排序)
        candidates.sort((a, b) => b.energy - a.energy);
        const topK = candidates.slice(0, 50);
        const others = candidates.slice(50);

        const refinedTopK = topK.map(node => {
            // 如果有 Query 指纹，进行多维对齐修正 (Rust 版 V3 逻辑)
            if (queryHashObj && node.simhash) {
                const nodeHash = new SimHash(node.simhash);
                let resonanceBoost = 0;

                // 1. 语义共鸣 (基础)
                const semanticSim = queryHashObj.similarityWeighted(nodeHash, SimHash.MASKS.SEMANTIC);
                resonanceBoost += semanticSim * 0.6; // 显著提升语义共鸣权重

                // 2. 时间共振 (Temporal Resonance)
                if ((queryHashObj.value & SimHash.MASKS.TEMPORAL) !== 0n) {
                    const temporalSim = queryHashObj.similarityWeighted(nodeHash, SimHash.MASKS.TEMPORAL);
                    // 时空匹配给予高权重 (0.5)，模拟“瞬间回忆”
                    resonanceBoost += temporalSim * 0.5;
                }

                // 3. 情感共鸣 (Affective Resonance) - 位运算
                if ((queryHashObj.value & SimHash.MASKS.AFFECTIVE) !== 0n) {
                    if (SimHash.bitwiseMatch(queryHashObj, nodeHash, SimHash.MASKS.AFFECTIVE)) {
                        resonanceBoost += 0.6; // 只要有任何共同情感位被激活，就产生强烈共鸣
                    }
                }

                // 4. 类型对齐 (Entity Type Alignment)
                if ((queryHashObj.value & SimHash.MASKS.ENTITY) !== 0n) {
                    const typeSim = queryHashObj.similarityWeighted(nodeHash, SimHash.MASKS.ENTITY);
                    // 类型匹配极其重要 (0.8)，因为类型不对通常意味着完全无关
                    resonanceBoost += typeSim * 0.8;
                }

                // 将共鸣增益融入最终能量
                node.energy = (node.energy * 0.7) + (resonanceBoost * 0.3);
            }
            return node;
        });

        // 重新排序并合并
        return [...refinedTopK, ...others].sort((a, b) => b.energy - a.energy);
    }

    /**
     * 导出图谱状态
     */
    exportState() {
        return {
            nodes: Array.from(this.nodes.entries()),
            edges: Array.from(this.edges.entries())
        };
    }

    /**
     * 导入图谱状态
     */
    importState(state) {
        if (!state) return;
        this.nodes = new Map(state.nodes);
        this.edges = new Map(state.edges);
    }
}

module.exports = GraphEngine;
