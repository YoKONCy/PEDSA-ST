/**
 * Storage - 持久化存储层
 * 
 * 针对浏览器环境（酒馆插件）设计的 IndexedDB 存储实现。
 * 负责保存和加载 GraphEngine 中的节点与边，实现“永恒记忆”。
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
            const request = indexedDB.open(this.dbName, 1);

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
     * 保存图谱状态
     * @param {Map} nodes 
     * @param {Map} edges 
     */
    async saveGraph(nodes, edges) {
        const data = {
            nodes: Array.from(nodes.entries()),
            edges: Array.from(edges.entries()),
            lastSaved: Date.now()
        };

        if (this.isMock) {
            this.mockData['graph'] = data;
            return;
        }

        return this._put('graph', data);
    }

    /**
     * 加载图谱状态
     * @returns {Object|null}
     */
    async loadGraph() {
        if (this.isMock) {
            return this.mockData['graph'] || null;
        }
        return this._get('graph');
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
