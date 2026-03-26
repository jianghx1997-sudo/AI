# 最高优先级要求

无论是开启一个新的对话，还是换一个新的 AI，这个项目都必须能被立刻接手，并按说明稳定产出符合要求的结果。

这意味着：
- 规则不能只停留在聊天里
- 关键边界不能依赖隐藏上下文
- 写作、落盘、出图三步都要有明确职责

## 项目定位

这个仓库不是一个独立产品，而是一套面向“小红书知识卡笔记”的对话式内容生产工作流。

当前目标是：
- 稳定产出符合要求的审核稿
- 将审核稿落为本地可编辑文稿
- 用户确认后再生成最终图片

## 新 AI 入口

如果是新对话或新 AI 接手，请先读：
- [新AI接手本项目的最短启动说明](E:\AI\know-all\docs\新AI接手本项目的最短启动说明.md)

## 当前标准流程

1. 用户给出话题
2. 写作阶段生成审核稿
3. 本地审核文档阶段将审核稿写入 `outputs/YYYYMMDD_话题/01_审核稿.xlsx`
4. 用户直接修改本地文稿
5. 用户明确确认文稿无误
6. 从本地文稿读取内容，整理成 `02_approved-note-pack.json`
7. 出图阶段生成最终图片

## 三段职责

### 1. 写作阶段
- 只负责审核稿内容
- 负责标题、封面文案、知识卡内容、语气、深度
- 不负责本地文档落盘

### 2. 本地审核文档阶段
- 只负责创建专题文件夹和 `01_审核稿.xlsx`
- 负责本地审核表格固定结构和话题库超链接
- 本地审核表格一旦存在，即成为审核阶段唯一 source of truth

### 3. 出图阶段
- 只负责从已确认的本地文稿读取内容并出图
- 不负责回改文稿
- 默认按固定模板参数执行，而不是临场发明新版式

## 本地审核 xlsx 的唯一允许实现

从现在开始，本地审核表格只能通过下面这条链路生成：

`UTF-8 结构化源文件 -> tools/write_review_xlsx.py -> outputs/YYYYMMDD_话题/01_审核稿.xlsx`

明确规定：
- 唯一允许的写入脚本是 [tools/write_review_xlsx.py](E:\AI\know-all\tools\write_review_xlsx.py)
- 旧的 docx 专用写入脚本只视为历史遗留，不再作为默认入口
- 不再允许通过 shell 内联大段中文、emoji 和中文路径直接拼装本地审核文档

这样做的目的，是彻底避开：
- 中文路径被 shell 破坏成 `???`
- emoji 写入失败
- 本地审核源结构不稳定

## 专题文件夹约定

每个专题都单独放在 `outputs/` 下：

```text
outputs/
  20260324_鸡尾酒/
    01_审核稿.xlsx
    02_approved-note-pack.json
    话题-cover.png
    话题-card-01.png
    ...
```

## 话题库文件

当前只保留一个最终版：
- [topic_library_final.xlsx](E:\AI\know-all\outputs\topic_library_final.xlsx)

补充约束：
- 不由脚本新增筛选功能
- 必须保留你手工新增的列，例如“发布日期”
- 如果你手工新增话题，脚本只补超链接，不重建表头、不覆盖其他列

对应脚本：
- [tools/update_topic_library_links.py](E:\AI\know-all\tools\update_topic_library_links.py)

## 关键规则

- 平台标题最长不超过 20 字
- 每篇通常 2 到 6 个知识点，不能硬凑
- 封面列点默认与知识卡数量保持一致
- 每张知识卡正文默认目标为 320 到 380 字
- emoji 属于文稿阶段，不属于渲染阶段临时补充
- 文稿确认后，出图阶段无权擅自回改文稿

## 关键文档

- [对话式内容生产工作流方案](E:\AI\know-all\docs\对话式内容生产工作流方案.md)
- [审核文案与出图统一格式规范](E:\AI\know-all\docs\审核文案与出图统一格式规范.md)
- [异常处理规则](E:\AI\know-all\docs\异常处理规则.md)
- [approved-note-pack.example.json](E:\AI\know-all\docs\approved-note-pack.example.json)
- [小红书闲聊语料库内容规范与写作技能说明](E:\AI\know-all\小红书闲聊语料库内容规范与写作技能说明.md)
- 全局生图模板参数说明：`C:\Users\94895\.codex\skills\daily-chat-corpus-card-renderer\references\render-spec.md`

## 规则优先级

后续默认按这个优先级执行：

1. 对应 skill 及其 reference
2. [审核文案与出图统一格式规范](E:\AI\know-all\docs\审核文案与出图统一格式规范.md)
3. [对话式内容生产工作流方案](E:\AI\know-all\docs\对话式内容生产工作流方案.md)
4. [README.md](E:\AI\know-all\README.md)

## 长期反馈机制

如果你的修改意见属于“以后都要这样”的长期标准：
- 我不能只修当前结果
- 必须同步更新对应 skill 和仓库文档

一句话总结：

`这个项目的价值在于规则、结构、模板和 skill，而不是独立产品外壳。`
