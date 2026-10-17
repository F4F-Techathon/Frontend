# 饭店请就位

Vue 3 + TypeScript + Pinia 的移动端选餐体验，复用 `damo.html` 中的 SVG 角色、复古配色与剧场视觉。

## 本地运行

```sh
npm install
npm run dev
```

```sh
npm test       # 需求解析、筛选、依据关联、用户定店、会话恢复
npm run build  # TypeScript 检查与生产构建
```

需要 Node.js 22.18+（22.x）或 24.12+。

## 页面流程

首页 → 表达需求 → 滑卡选店 → 集合开场 → 餐馆辩论 → 用户选定饭店 → 餐厅详情。

左滑跳过、右滑邀请，也支持键盘方向键；卡片下方常驻小地图、当前餐厅地址和直线距离，随滑卡同步位置，无需展开；不设操作按钮，开场在顶部。支持取消邀请，不会自动填满选手。右上角可调整条件，硬条件排除不符合或相关信息未知的餐厅，偏好作为讨论内容，饭店顺序保持稳定。滑卡进度、选择、讨论历史与新条件保存在当前浏览器。开场保留地图集合和拉幕布动画。讨论页右上角的「做出决定」打开饭店选择，用户选中并确认后才生成结果；讨论结束也会等待用户选择。浏览依据和历史时讨论暂停，通过播放按钮继续。

## 地图配置

将 `.env.example` 复制为 `.env.local`，设置高德 Web JS API Key 与安全配置。本地配置文件已被 `.gitignore` 忽略。环境变量变更后需要重新启动 Vite。

地图使用高德 JS API 2.0，支持地点搜索、定位、平移缩放和候选标记。地图在滑卡时预载，开场时展示集合动画；加载失败不影响滑卡和入场。生产环境可通过 `VITE_AMAP_SERVICE_HOST` 设置安全代理，参见[高德安全配置文档](https://developer.amap.com/api/javascript-api-v2/guide/abc/jscode)。

## 数据与服务边界

- 餐厅、价格、评价和发言来自 `src/data/` 中的演示数据，不代表真实商家或真实用户评论；依据中保留数据性质与来源，讨论页直接就地展开。
- 主图是按菜系选配的示意照片，使用本地 WebP 文件；[摄影师与图片来源](src/assets/images/restaurants/CREDITS.md)保存在素材目录中。
- 地图底图与地点搜索调用高德真实服务；餐厅演示坐标集中在上海静安寺附近。
- 需求解析与条件筛选目前使用本地规则，辩论为按当前选手和条件生成的固定轮次，最终饭店由用户自行选择，尚未连接多智能体后端。
- 初始需求使用单按钮语音输入，说完后自动进入筛选；需要浏览器支持语音识别并允许麦克风。讨论中的补充需求仍支持文字输入，播放使用设备语音合成。
- 未接入预订、电话或商家交易服务，不展示预订成功等虚构结果。

## 主要代码

- `src/views/`：需求、滑卡、讨论、结果等页面
- `src/components/`：SVG 角色、舞台关联界面、筛选、地图、通用抽屉
- `src/stores/dining.ts`：跨页面状态、选择、历史与恢复
- `src/data/`：演示餐厅、证据、发言与类型
- `src/lib/characterRig.js`：从参考演示提取的角色绘制模块
- `src/lib/filtering.ts`：需求解析、硬条件过滤与距离计算
- `src/lib/amap.ts`：高德 SDK 加载与错误重试

## 仓库与日常开发

远程仓库：[F4F-Techathon/Frontend](https://github.com/F4F-Techathon/Frontend)。本地直接在本项目目录开发。

```sh
git pull --rebase
# 修改代码后
npm test
npm run build
git add .
git commit -m "说明本次修改"
git push
```

`.env.local`、`node_modules/` 和 `dist/` 不提交。其他设备克隆后，运行 `npm install`，再从 `.env.example` 创建本机的 `.env.local`。
