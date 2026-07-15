# Invoice Rail

Invoice Rail 是一个面向 Arc Testnet 的稳定币发票与对账 MVP。商户生成 USDC 或 EURC 付款请求，付款方通过浏览器钱包签名，应用使用 Arc 预部署的 `Memo` 合约把转账与发票 ID 原子绑定，并可在链上重新核验付款状态。

当前 Alpha 不托管私钥、不需要自定义合约。开发环境默认使用嵌入式 PostgreSQL，部署时可通过 `DATABASE_URL` 无代码切换到托管 PostgreSQL。

## 已实现

- 创建 USDC / EURC 发票并同步到服务端数据库
- 钱包消息签名登录、一次性 challenge 与 HttpOnly 会话
- 商户发票和 Webhook API 按已验证钱包地址隔离
- 地址型团队工作区，支持 owner、editor、viewer 三种角色
- 工作区切换、团队成员管理、Webhook 管理和 CSV 导出界面
- 生成 `/pay/<shareId>` 服务端短付款链接
- 支持 MetaMask、Rabby、Coinbase Wallet、Rainbow 等 EIP-1193 钱包
- 自动添加或切换至 Arc Testnet
- 通过 Arc `Memo.memo(...)` 完成带发票标识的稳定币转账
- 按 `memoId` 查询事件，并校验目标代币与完整转账 calldata 哈希
- 按区块游标自动索引 Memo 事件，并使用交易哈希与日志序号幂等入账
- 可独立运行的索引 Worker，以及带 HMAC 签名和重试队列的 `invoice.paid` Webhook
- 支持 PGlite 本地存储和 `pg` 托管 PostgreSQL 连接池
- 自动迁移当前浏览器中已有的旧发票
- 显示链上余额、RPC 状态、交易回执和错误状态
- 响应式浅色 / 深色界面
- 对付款链接执行严格字段校验，避免直接信任 URL 数据

## 本地运行

要求 Node.js 22+ 与 pnpm。

```bash
pnpm install
pnpm dev
```

打开 [http://localhost:3000](http://localhost:3000)。如需替换 RPC：

```bash
cp .env.example .env.local
```

## 工程验证

```bash
pnpm check
pnpm test:auth
pnpm verify:invoice -- <invoice-id> <recipient> <amount> USDC
pnpm indexer -- --once
```

`pnpm check` 会依次运行单元测试、ESLint 和生产构建。

`test:auth` 是端到端安全测试，需要本地开发服务正在运行。它使用一次性临时测试钱包，不读取真实钱包私钥。

本地数据库默认位于 `.data/invoice-rail`。修改 `INVOICE_RAIL_DB_DIR` 可以更换位置。设置 `DATABASE_URL` 后会自动使用托管 PostgreSQL；建议在连接串中显式设置云数据库要求的 `sslmode`。

索引器会在商户列表同步时运行，也可以由本地任务或定时任务触发：

```bash
curl -X POST http://localhost:3000/api/indexer
```

公开部署时应设置 `INDEXER_SECRET`，并通过 `Authorization: Bearer <secret>` 调用索引器端点。

长期运行的后台进程使用同一个端点，同时处理 Arc 索引与 Webhook 投递：

```bash
INVOICE_RAIL_APP_URL=https://your-app.example \
INDEXER_SECRET=replace-me \
pnpm indexer
```

生产环境必须设置 `APP_ORIGIN`、`DATABASE_URL` 和 `INDEXER_SECRET`。`APP_ORIGIN` 用于校验签名消息和所有带 Cookie 的写请求来源。

## 生产部署

项目包含可复用的多阶段 `Dockerfile` 和 `compose.yaml`。同一个镜像分别运行：

- Next.js Web/API 服务；
- Arc 索引与 Webhook 投递 Worker；
- 通过 `DATABASE_URL` 连接的 PostgreSQL。

本地启动接近生产环境的完整栈：

```bash
cp .env.docker.example .env.docker
# 替换文件中的两个占位 secret
docker compose --env-file .env.docker up --build
curl --fail http://localhost:3000/api/health
```

`/api/health` 会检查应用能否访问并初始化数据库。云平台部署拓扑、环境变量和发布验收步骤见 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)。

## 钱包登录与 Webhook

商户连接钱包后点击 `Sign in`，签署的是登录消息，不会发送交易或消耗 Gas。挑战 5 分钟过期且只能使用一次，会话默认持续 7 天。`GET /api/invoices` 不再接受商户地址参数，只使用已验证会话中的地址。

登录后可通过 `/api/webhooks` 创建、查询和删除端点。创建响应中的 `whsec_...` 只返回一次。每次付款通知包含：

```text
X-Invoice-Rail-Delivery: evt_...
X-Invoice-Rail-Signature: t=<unix-seconds>,v1=<hmac-sha256>
```

签名内容为 `<timestamp>.<raw-request-body>`。公开端点必须使用 HTTPS；本地开发可使用 localhost HTTP。

## 团队工作区

每个已登录钱包天然拥有一个工作区。owner 可以把其他 EVM 地址添加为 editor 或 viewer：

- `owner`：管理成员、Webhook、发票和导出。
- `editor`：查看、创建发票和导出。
- `viewer`：只读查看和导出。

成员使用自己的钱包签名登录后，会在首页工作区选择器中看到获授权的工作区。CSV 导出会对所有单元格加引号，并中和电子表格公式前缀，降低导出文件的公式注入风险。

## Arc Testnet 配置

| 项目 | 值 |
| --- | --- |
| Chain ID | `5042002` |
| RPC | `https://rpc.testnet.arc.network` |
| Explorer | `https://testnet.arcscan.app` |
| Memo | `0x5294E9927c3306DcBaDb03fe70b92e01cCede505` |
| USDC ERC-20 interface | `0x3600000000000000000000000000000000000000` |
| EURC | `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a` |

USDC 是 Arc 的原生 Gas 资产。原生接口内部使用 18 位精度，应用层 ERC-20 接口使用 6 位精度，两者共享同一余额。本项目遵循 Arc 的建议，在应用层统一使用 6 位 ERC-20 接口。

## 使用流程

1. 商户连接钱包，填写金额、收款地址、币种、备注与到期日。
2. 应用取得当前 Arc 区块高度，将发票和校验哈希写入服务端数据库。
3. 商户复制付款链接发给付款方。
4. 付款方打开链接，切换到 Arc Testnet 并签名交易。
5. 应用等待 1 个区块确认，展示 ArcScan 回执。
6. Arc 索引器按区块游标发现 Memo 事件，自动把发票更新为 `Paid`。

测试网资产没有真实价值。不要在项目中粘贴或保存私钥。

## 下一阶段

钱包鉴权、团队角色、托管数据库连接层、独立 Worker、Webhook 和 CSV 导出已经完成。下一阶段按以下顺序推进：

1. 在目标云平台配置真实 `DATABASE_URL`，运行独立 Web 与 Worker 实例。
2. 增加邀请接受流程、工作区命名、投递记录和 Webhook 死信重放。
3. 增加限流、集中日志、告警、退款状态机和数据库迁移流水线。
4. 接入 Circle App Kit，支持从其他网络发起 USDC 跨链结算。

详细设计见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

## 官方资料

- [Arc Transaction Memos](https://docs.arc.io/arc/concepts/transaction-memos)
- [Send USDC with a transaction memo](https://docs.arc.io/arc/tutorials/send-usdc-with-transaction-memo)
- [Arc contract addresses](https://docs.arc.io/arc/references/contract-addresses)
- [Circle App Kit](https://docs.arc.io/app-kit)
