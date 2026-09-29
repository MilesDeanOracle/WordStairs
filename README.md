# 词阶 WordStairs

面向小学高年级至高中学生的英语单词 / 句子学习工具，覆盖听、说、读、写四项训练。
前端 React，后端 FastAPI，前后端分离。

- 产品与技术设计：[docs/设计方案.md](docs/设计方案.md)
- 交互风格演示页（单文件 HTML）：[demo/index.html](demo/index.html)

## 目录结构

```
backend/          FastAPI 后端
  app/
    main.py         入口（启动时建表）
    config.py       常量（每日上限、新词量等）
    database.py     SQLAlchemy / SQLite
    models.py       数据模型（书/单元/单词/用户/积分）
    auth.py         bcrypt 密码 + JWT + 管理员守卫
    sm2.py          简化 SM-2 间隔重复
    points.py       积分引擎（落账、每日上限、阶位、任务）
    create_admin.py 创建/提升管理员脚本
    serialize.py    响应序列化
    routers/        auth / books(导入) / content(书架CRUD) / study / practice / points / admin
frontend/         React 18 + Vite + TS 前端
  src/
    pages/          Login / Today / Practice / Admin
    components/     Topbar / Flashcard / Tasks / Listen / Spell / Scramble / Speak / Bookshelf / ImportPanel
    api/            fetch 封装 + 类型
    store/          zustand（登录态、toast / 积分飘字）
    utils/speech.ts TTS、语音识别、跟读相似度
demo/              设计演示单页
docs/              设计文档
```

## 启动

后端（首次启动自动建库 app.db 并写入种子词书）：

```bash
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8735 --reload
```

前端（开发模式，已配置代理到后端 8735）：

```bash
cd frontend
npm install
npm run dev
```

打开 http://localhost:5173 ，注册一个账号即可开始（注册后自动使用六年级词书）。

## V1 已实现

- 顶栏底部中央的**书签丝带**：点击展开「学习范围」抽屉——课本复选框整本开关；每本书一条 **antd Slider 双柄区间滑块**（`range` + 可拖轨道，主题定制为墨蓝手柄/红色填充），拖两端选出一段单元（如 Unit 2–5），选中单元同时用于今日学习和专项练习
- UI：学生端手写组件为主，antd 5 已引入（ConfigProvider 主题对齐练习本配色），后续管理端表格表单可继续采用
- 注册 / 登录（JWT），管理页指派词书 = 自动全选该书单元
- 今日队列：到期复习 + 每日新词，闪卡翻面、认识 / 想了一下 / 不认识，SM-2 调度
- 专项练习：听音辨词（TTS + 键盘作答）、拼写默写（四线三格逐字母判分）、句子重组、跟读评分（浏览器语音识别）
- 积分体系：练习答对加分、每日 300 上限、阶位（每 200 分一阶）、积分流水；过卡（认识/想了一下/不认识）不加分
- 今日任务：按实际完成情况自动勾选（复习 20 词 / 拼写一次 / 跟读 3 句）
- 管理端（管理员登录后可见）：
  - **账号**：学习情况一览，为每个账号指派当前词书
  - **书架管理**：书 → 单元 → 单词三级结构，全部可增删改（新建书/单元、单词表内编辑、两级确认删除）
  - **生词导入**：先在书架选中单元作为目标，再导入；支持 Excel (.xlsx) / CSV 文件拖拽上传、粘贴文本
  - 文件第一行为表头（单词、音标、词性、释义、例句、例句翻译，自动识别中英文列名）；无表头则按「单词, 音标, 释义, 例句」位置解析；CSV 自动兼容 UTF-8 / GBK 编码
  - 管理页提供 **下载导入模板**（.xlsx，带三行示例）
- 管理员创建/提升：`python -m app.create_admin [用户名] [密码]`

## 路线图（见设计文档）

服务端 TTS 音频缓存、连击加成、印章徽章、奖励兑换与家长端、
周报统计、错题本、智能混练、专业发音评估接口、移动端 PWA。
