/**
 * Storage - 持久化存储层
 * 
 * 针对浏览器环境（酒馆插件）设计的 IndexedDB 存储实现。
 * 负责保存和加载 GraphEngine 中的节点与边，实现"永恒记忆"。
 * 
 * V3: 适配双层图谱 (ontologyEdges + memoryEdges) 结构喵~
 */

class Storage {
    constructor(dbName = 'PEDSA_Memory', storeName = 'GraphData') {
        this.dbName = dbName;
        this.storeName = storeName;
        this.db = null;
    }

    /**
     * 初始化数据库
     */
    async init() {
        if (typeof indexedDB === 'undefined') {
            console.warn('[Storage] 当前环境不支持 IndexedDB，将使用内存模拟存储。');
            this.isMock = true;
            this.mockData = {};
            return;
        }

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 2); // 升级版本号喵~

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName);
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve();
            };

            request.onerror = (event) => {
                reject('IndexedDB 初始化失败: ' + event.target.error);
            };
        });
    }

    /**
     * 保存图谱状态 (V3 双层图谱版)
     * @param {GraphEngine} engine - 图引擎实例
     */
    async saveGraph(engine) {
        const data = engine.exportState();
        data.lastSaved = Date.now();

        if (this.isMock) {
            this.mockData['graph'] = data;
            return;
        }

        return this._put('graph', data);
    }

    /**
     * 加载图谱状态到引擎 (V3 双层图谱版)
     * @param {GraphEngine} engine - 图引擎实例
     * @returns {boolean} 是否成功加载
     */
    async loadGraph(engine) {
        let data;
        if (this.isMock) {
            data = this.mockData['graph'] || null;
        } else {
            data = await this._get('graph');
        }

        if (!data) return false;

        engine.importState(data);
        return true;
    }

    /**
     * 保存关键词匹配器数据喵~
     * @param {KeywordMatcher} matcher
     */
    async saveMatcher(matcher) {
        const data = {
            definitions: matcher.definitions,
            lastSaved: Date.now()
        };

        if (this.isMock) {
            this.mockData['matcher'] = data;
            return;
        }

        return this._put('matcher', data);
    }

    /**
     * 加载关键词匹配器数据喵~
     * @param {KeywordMatcher} matcher
     * @returns {boolean}
     */
    async loadMatcher(matcher) {
        let data;
        if (this.isMock) {
            data = this.mockData['matcher'] || null;
        } else {
            data = await this._get('matcher');
        }

        if (!data || !data.definitions) return false;

        matcher.definitions = data.definitions;
        matcher.build();
        return true;
    }

    /**
     * 清除所有存储数据喵~
     */
    async clear() {
        if (this.isMock) {
            this.mockData = {};
            return;
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.clear();

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 内部方法：写入数据
     */
    _put(key, value) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.put(value, key);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 内部方法：读取数据
     */
    _get(key) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(key);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
}

module.exports = Storage;
