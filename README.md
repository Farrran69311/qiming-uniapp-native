# Hi👋 hello the next generation juiced native Android app in the edu area presented by ycxj Jilin
## ccut 108 全新 启明智教 (Qimingedu) - Android 客户端

### Checkout from the pics first Stu Teacher and Admin

<p align="center">
<img width="400" height="833" alt="image" src="https://github.com/user-attachments/assets/1e7b4d23-2014-42de-b5da-1b194b4cf4c8" />
<img width="397" height="829" alt="image" src="https://github.com/user-attachments/assets/c85d7aab-e49d-494c-8164-2b88d071fe74" />
<img width="392" height="804" alt="image" src="https://github.com/user-attachments/assets/9878a4fd-1d0d-42e0-8f81-4e1c7493d36c" />
<img width="394" height="828" alt="image" src="https://github.com/user-attachments/assets/4b27c936-a290-4e26-8a25-cee2c16d861a" />
  </p>
  <p align="center">
<img width="396" height="830" alt="image" src="https://github.com/user-attachments/assets/18137d8e-bd39-42d1-8d21-2b532c8584f5" />
<img width="403" height="830" alt="image" src="https://github.com/user-attachments/assets/64c7b42d-6a13-4d25-a23a-0aa05e30a8dd" />
<img width="398" height="831" alt="image" src="https://github.com/user-attachments/assets/29ed07d3-17c8-4046-8834-6d84c6dee125" />
<img width="395" height="836" alt="image" src="https://github.com/user-attachments/assets/9fd5810d-91e4-4360-9986-f2a13cbf91c0" />
  </p>
    <p align="center">
<img width="389" height="817" alt="image" src="https://github.com/user-attachments/assets/1b7edce3-3e92-4076-be37-d1ff6b2d6e9d" />
<img width="401" height="834" alt="image" src="https://github.com/user-attachments/assets/1d3918cc-837d-49ca-a812-5b2a32762ed6" />
  </p>

## 项目简介

**启明智教** 是一款由 AI 驱动的智能化教育与课堂监控平台 Android 客户端。本项目致力于通过先进的人工智能技术优化教学流程，为师生提供高效、个性化的教育互动体验。客户端采用 UniApp 框架开发，深度优化 Android 原生渲染体验，保障复杂的交互与数据流依然丝滑流畅。

依托平台强大的微服务后端架构（基于 Go-Zero 与 Python FastAPI），客户端无缝接入了核心的 **EduClaw 智能体**。同时，结合底层的高效 **SAHR (Semantic Adaptive Hybrid Retrieval) 语义自适应混合检索框架**（精确调优的融合权重：稀疏检索 0.7，稠密检索 0.3），客户端能够在海量教学知识库中实现极高精度的检索、问答与辅助决策。

##  核心功能

* **伴学答疑 (EduClaw 智能体):** 深度集成定制化智能体，提供全天候的自适应教学引导与精准解答。
* **高精度知识检索引擎:** 借助 SAHR 混合检索算法，打破传统检索的语义壁垒，极速定位教学资源与文献。
* **课堂状态监控与分析:** 接入 AI 视觉与多维数据分析，实时反馈课堂教学状态，助力教育数字化转型（核心算法及应用已布局多项软著与专利）。
* **原生级流畅体验:** 充分利用 App-Plus 扩展能力，调用 Android 底层 API，实现高效的设备硬件交互与网络并发处理。

## 其他功能
* **其余教育平台所拥有的基础功能之上  我们融合全新的完整数据链路** 
* **教师端管理员端更高效的AI融合备课组件** 
* **教师端管理员端更精准的提效建议与工作效率分析**
* **教师端管理员端更个性化的个人画像分析**
* **学生端AI导学组卷** 
* **学生端AI当节课程知识问答**
* **学生端AI思维导图** 
* **融合了多模态资源的AI助手回答与生成**
* **响应迅速的截图提问功能** 
* **启明智教精调的垂直领域大模型**
* **----还有更多----**

##  技术栈与依赖

* **前端框架:** UniApp (Vue 3 语法 / 组合式 API)
* **构建与编译:** Vite / HBuilderX
* **网络通信:** 封装 `uni.request`，支持 RESTful API 与长链接 WebSocket 交互
* **核心关联后端:** * 业务逻辑层：Go-Zero
    * 模型服务层：Python FastAPI
* **前端技术**： Element Plus, Tailwind CSS, Sass,Three.js, ECharts , LogicFlow/Vue-Flow , WangEditor/Vditor等等

##  快速开始

### 1. 环境准备
* 安装 [Node.js](https://nodejs.org/) (推荐 v16.x 或以上版本)
* 安装 [HBuilderX](https://www.dcloud.io/hbuilderx.html) 开发者工具
* 准备 Android Studio 模拟器或真实的 Android 物理测试设备（需开启“开发者模式”及“USB 调试”）

### 2. 克隆项目代码

```bash
git clone git@github.com:Farrran69311/qiming-uniapp-native.git
cd qiming-uniapp-native
