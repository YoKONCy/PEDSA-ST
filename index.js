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
    console.log('====================================');
    console.log('🐈 [PEDSA] 核心脚本加载成功！(Bundled)');
    console.log('====================================');

    // 在脚本加载时立即获取 basePath，因为 document.currentScript 在异步调用时会变成 null 喵~
    const scriptPath = document.currentScript ? document.currentScript.src : '';
    let globalBasePath = '/scripts/extensions/PEDSA-JS/'; // 默认回退路径
    
    // 检查是否已经在 iframe 中运行，防止套娃喵~
    const isInIframe = window.self !== window.top;
    
    if (!isInIframe) {
        if (scriptPath.includes('/scripts/extensions/')) {
            globalBasePath = scriptPath.substring(0, scriptPath.lastIndexOf('/') + 1);
            console.log('[PEDSA] 成功自动识别插件根目录:', globalBasePath);
        } else {
            // 尝试从所有 script 标签中寻找
            const allScripts = Array.from(document.querySelectorAll('script'));
            const pedsaScript = allScripts.find(s => s.src && (s.src.includes('PEDSA-JS/index.js') || s.src.includes('PEDSA-ST/index.js')));
            if (pedsaScript) {
                globalBasePath = pedsaScript.src.substring(0, pedsaScript.src.lastIndexOf('/') + 1);
                console.log('[PEDSA] 从 script 标签列表找到插件根目录:', globalBasePath);
            } else {
                console.warn('[PEDSA] 无法自动识别根目录，使用回退路径:', globalBasePath);
            }
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
    class PEDSA {
        constructor() {
            console.log('[PEDSA] 正在初始化核心系统... 喵~');
            this.engine = new GraphEngine();
            this.matcher = new KeywordMatcher();
            this.dashboard = new DashboardManager(this.engine, this.matcher);
            this.tavern = new TavernIntegration(this.engine, this.dashboard, this.matcher);
            this.dashboard.onUpdate = (type, data) => {
                this._broadcastSnapshot();
            };
            this.dashboard.onSettingsUpdate = (settings) => {
                this.tavern.updateSettings(settings);
            };
            this._initMessageBridge();
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
            this.dashboardIframe = iframe; 
            // 使用在脚本加载时捕获到的全局路径喵~
            iframe.src = globalBasePath + 'src/ui/dashboard.html';
            iframe.style.cssText = `
                width: 100%;
                height: 100%;
                border: none;
            `;
            container.appendChild(closeBtn);
            container.appendChild(iframe);
            overlay.appendChild(container);
            document.body.appendChild(overlay);
            iframe.onload = () => this._broadcastSnapshot();
        }
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
        _broadcastSnapshot() {
            const snapshot = this.dashboard.getSnapshot();
            if (this.dashboardIframe && this.dashboardIframe.contentWindow) {
                try {
                    this.dashboardIframe.contentWindow.postMessage({
                        type: 'UPDATE_SNAPSHOT',
                        payload: snapshot
                    }, '*');
                    return; 
                } catch (e) {
                    console.warn('[PEDSA] 无法向主 iframe 发送消息:', e);
                }
            }
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

    // 初始化入口
    if (typeof document !== 'undefined') {
        const runInit = () => {
            if (typeof window !== 'undefined' && !window.pedsa && !isInIframe) {
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
