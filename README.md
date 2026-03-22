# PEDSA-ST 记忆拓扑操作系统 🐾

基于 **激活扩散模型 (Activation Diffusion)** 与 **SimHash 多模态共鸣** 的 SillyTavern 记忆增强插件喵~

## 🌟 核心特性

- **双层激活扩散**: 采用激活扩散算法，模拟人类大脑的联想记忆，让 AI 能够根据当前对话精准唤起深层记忆。
- **SimHash 多模态共鸣**: 通过高效的位运算检测语义相似度，实现跨语境的记忆共鸣。
- **实时拓扑渲染**: 提供华丽的仪表盘 UI，实时展示记忆节点的激活状态与连接权重。
- **酒馆深度集成**: 完美适配 SillyTavern 插件架构，监听聊天事件并自动管理上下文。

## 🛠️ 技术架构

- **[GraphEngine.js](src/core/GraphEngine.js)**: 记忆图谱核心引擎，处理节点激活与衰减逻辑。
- **[SimHash.js](src/core/SimHash.js)**: 语义指纹生成与共鸣度计算。
- **[TavernIntegration.js](src/core/TavernIntegration.js)**: 负责与酒馆核心 API 的双向通信。
- **[DashboardManager.js](src/core/DashboardManager.js)**: 状态快照管理与 UI 桥接。

## 🎨 界面预览

在扩展页点击入口后，你会看到一个全屏的毛玻璃遮罩层，内部实时渲染当前的记忆拓扑网络。你可以观察到节点是如何随着对话的进行而“闪烁”激活的喵！

---

**Author**: Neko-Carola
**Repository**: [https://github.com/YoKONCy/PEDSA-ST](https://github.com/YoKONCy/PEDSA-ST)
