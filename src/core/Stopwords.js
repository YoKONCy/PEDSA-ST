/**
 * Stopwords - 停用词库
 * 
 * 用于过滤中文虚词、英语介词/代词/助动词等无意义词汇，
 * 防止它们成为图谱中的高频噪声节点。
 * 
 * 移植自 PEDSA (Rust) src/storage.rs
 */

const STOPWORDS = new Set([
    // 中文虚词
    "的", "是", "了", "在", "我", "你", "他", "她", "它", "们", "这", "那", "都", "和", "并", "且",
    "也", "就", "着", "吧", "吗", "呢", "啊", "呀", "呜", "哎", "哼", "呸", "喽", "个", "只", "条",
    "件", "双", "本", "页", "次", "回", "场", "阵", "些", "点", "块", "片", "段", "层", "座", "栋",
    
    // 英语介词
    "a", "an", "the", "about", "above", "across", "after", "against", "along", "among", "around", "at", 
    "before", "behind", "below", "beneath", "beside", "between", "beyond", "but", "by", "despite", "down", 
    "during", "except", "for", "from", "in", "inside", "into", "like", "near", "of", "off", "on", "onto", 
    "out", "outside", "over", "past", "since", "through", "throughout", "till", "to", "toward", "under", 
    "underneath", "until", "up", "upon", "with", "within", "without",
    
    // 英语代词
    "i", "me", "my", "mine", "we", "us", "our", "ours", "you", "your", "yours", "he", "him", "his", 
    "she", "her", "hers", "it", "its", "they", "them", "their", "theirs", "this", "that", "these", "those", 
    "who", "whom", "whose", "which", "what", "each", "every", "either", "neither", "some", "any", "no", 
    "none", "both", "few", "many", "other", "another",
    
    // 英语助动词
    "am", "is", "are", "was", "were", "be", "being", "been", "have", "has", "had", "do", "does", "did", 
    "shall", "will", "should", "would", "may", "might", "must", "can", "could",
    
    // 英语连词及其他
    "and", "or", "so", "nor", "yet", "although", "because", "unless", "while", "where", "when", "how", "whether"
]);

module.exports = {
    has: (word) => STOPWORDS.has(word.toLowerCase())
};
