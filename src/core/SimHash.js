/**
 * SimHash - 局部敏感哈希 (JS 实现)
 * 
 * 用于快速计算语义、时间、情感和实体类型的相似度。
 * 采用 64 位整数存储，利用 BigInt 进行位运算。
 */

class SimHash {
    /**
     * 构造函数
     * @param {bigint|string|number} value - 哈希值
     */
    constructor(value) {
        this.value = BigInt(value);
    }

    /**
     * 计算汉明距离 (Hamming Distance)
     * @param {SimHash} other - 另一个 SimHash 对象
     * @returns {number} 汉明距离 (0-64)
     */
    hammingDistance(other) {
        let xor = this.value ^ other.value;
        let distance = 0;
        
        // 计算置位个数 (Population Count)
        let s = xor.toString(2);
        for (let char of s) {
            if (char === '1') distance++;
        }
        return distance;
    }

    /**
     * 计算相似度评分 (0.0 - 1.0)
     * @param {SimHash} other 
     * @returns {number}
     */
    similarity(other) {
        const distance = this.hammingDistance(other);
        return 1.0 - (distance / 64.0);
    }

    // build() 和 combine() 定义在文件底部喵~

    /**
     * 获取指定维度的哈希值
     * @param {bigint} mask - 维度掩码
     * @param {number} shift - 位移
     * @returns {bigint}
     */
    getDimension(mask, shift) {
        return (this.value & mask) >> BigInt(shift);
    }

    /**
     * 加权计算特定维度的相似度喵~
     * @param {SimHash} other 
     * @param {bigint} mask 
     * @returns {number} 0.0 - 1.0
     */
    similarityWeighted(other, mask) {
        let xor = (this.value ^ other.value) & mask;
        let distance = 0;
        let s = xor.toString(2);
        for (let char of s) {
            if (char === '1') distance++;
        }
        
        // 计算 Mask 中的总位数
        let maskStr = mask.toString(2);
        let totalBits = 0;
        for (let char of maskStr) {
            if (char === '1') totalBits++;
        }
        
        return totalBits === 0 ? 1.0 : 1.0 - (distance / totalBits);
    }

    /**
     * 位运算共振检查喵~ (用于情感位等)
     * 只要在掩码区域内有任何一位共同置位，即视为匹配
     */
    static bitwiseMatch(h1, h2, mask) {
        const v1 = (h1 instanceof SimHash ? h1.value : BigInt(h1)) & mask;
        const v2 = (h2 instanceof SimHash ? h2.value : BigInt(h2)) & mask;
        return (v1 & v2) !== 0n;
    }

    // 掩码定义 (与 Rust V3 保持一致)
    static MASKS = {
        SEMANTIC: BigInt("0x00000000FFFFFFFF"),   // [0-31] 语义
        TEMPORAL: BigInt("0x0000FFFF00000000"),   // [32-47] 时间
        AFFECTIVE: BigInt("0x00FF000000000000"),  // [48-55] 情感
        ENTITY: BigInt("0xFF00000000000000")      // [56-63] 实体类型
    };

    // 边类型定义喵~ (与 Rust V3 保持一致)
    static EDGE_TYPES = {
        REPRESENTATION: 'representation', // 0: 正常衰减
        EQUALITY: 'equality',             // 1: 等价传递 (零损耗)
        INHIBITION: 'inhibition',         // 255: 抑制传递 (扣减能量)
    };

    /**
     * 静态工厂方法：从多个 SimHash 中融合出一个“多数派”指纹 (Bit-Voting)
     * 用于处理一条消息命中多个关键词时的指纹合成。
     * @param {Array<SimHash>} hashes 
     * @returns {SimHash}
     */
    static combine(hashes) {
        if (!hashes || hashes.length === 0) return new SimHash(0n);
        if (hashes.length === 1) return hashes[0];

        let combined = 0n;
        const count = hashes.length;
        
        // 遍历 64 位，每一位进行投票
        for (let i = 0; i < 64; i++) {
            let bitPos = BigInt(i);
            let ones = 0;
            
            for (let h of hashes) {
                if ((h.value >> bitPos) & 1n) {
                    ones++;
                }
            }
            
            // 如果 1 的数量超过一半，则该位设为 1
            if (ones > (count / 2)) {
                combined |= (1n << bitPos);
            }
        }
        
        return new SimHash(combined);
    }

    /**
     * 静态工厂方法：从各个维度构建 SimHash
     */
    static build({ semantic = 0n, temporal = 0n, affective = 0n, entity = 0n }) {
        let val = (BigInt(semantic) & 0xFFFFFFFFn) |
                  ((BigInt(temporal) & 0xFFFFn) << 32n) |
                  ((BigInt(affective) & 0xFFn) << 48n) |
                  ((BigInt(entity) & 0xFFn) << 56n);
        return new SimHash(val);
    }
}

module.exports = SimHash;
