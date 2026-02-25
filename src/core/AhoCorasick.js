/**
 * AhoCorasick - 多模式匹配算法
 * 
 * 用于在 O(n) 时间复杂度内从文本中扫描成千上万个关键词。
 * 这是 PEDSA 能够处理大规模本体库的关键。
 */

class AhoCorasick {
    constructor() {
        this.trie = [{ next: {}, fail: 0, output: [] }];
    }

    /**
     * 向字典树添加模式串
     * @param {string} pattern 
     * @param {any} data - 关联的数据 (如 nodeId)
     */
    addPattern(pattern, data) {
        let node = 0;
        for (const char of pattern) {
            if (!this.trie[node].next[char]) {
                this.trie[node].next[char] = this.trie.length;
                this.trie.push({ next: {}, fail: 0, output: [] });
            }
            node = this.trie[node].next[char];
        }
        // V2 优化：存储模式串长度，以便后续进行冲突处理喵~
        this.trie[node].output.push({ data, length: pattern.length });
    }

    /**
     * 构建失败链接 (Failure Links)
     * 使用 BFS 遍历
     */
    build() {
        let queue = [];
        // 第一层节点的 fail 指向根节点
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

                // 合并输出列表 (当前节点的匹配也包含其 fail 指向节点的匹配)
                this.trie[v].output = [...this.trie[v].output, ...this.trie[this.trie[v].fail].output];
                queue.push(v);
            }
        }
    }

    /**
     * 在文本中搜索所有模式
     * @param {string} text 
     * @returns {Array} 匹配到的对象列表 { data, length, endPos }
     */
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

module.exports = AhoCorasick;
