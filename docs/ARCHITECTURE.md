# Invoice Rail 技术方案

## 1. 第一阶段目标

用最少的基础设施验证一个完整闭环：创建发票、分享链接、钱包付款、链上核验。第一阶段不部署自定义合约，直接复用 Arc Testnet 的预部署 `Memo` 合约，减少审计面与演示失败点。

## 2. 系统边界

```text
商户浏览器 ─┐
            ├─ Next.js 客户端 ─ EIP-1193 钱包 ─ Arc Testnet
付款方浏览器 ┘        │                        ├─ Memo 合约
                      ├─ 签名认证 / 发票 API      ├─ USDC 接口
                      ├─ PGlite 或 PostgreSQL     └─ EURC 合约
                      ├─ Webhook 出站队列
                      └─ 独立 Worker ─ Arc 索引 + Webhook 投递
```

发票以服务端数据库为准，`localStorage` 仅作为迁移和离线缓存。付款链接使用随机 128 位 `shareId`，页面通过服务端读取发票，不包含私钥、签名或访问令牌。旧 Base64URL 链接继续兼容。

## 3. 核心数据

发票公开字段：

- `id`：随机发票号，例如 `IR-260715-ABC123FF0000`
- `merchantName`：收款方显示名称
- `recipient`：EVM 收款地址
- `amount`：最多 6 位小数的十进制字符串
- `token`：`USDC` 或 `EURC`
- `memo`：最多 120 个字符
- `dueDate`、`createdAt`、`createdBlock`

服务端状态字段：

- `status`
- `txHash`
- `paidAt`

服务端额外保存 `shareId`、`merchantAddress`、`memoId`、`callDataHash` 和 `tokenAddress`。认证表保存一次性 challenge 的哈希和会话令牌哈希；数据库不保存原始会话令牌。`team_members` 使用工作区地址与成员地址作为复合主键。Webhook 使用 endpoint、delivery/outbox 两张表。旧付款链接解码后仍会逐字段验证。

## 4. 付款交易

应用生成以下值：

```text
memoId      = keccak256(invoice.id)
transferData = ERC20.transfer(recipient, parseUnits(amount, 6))
callDataHash = keccak256(transferData)
memoData     = UTF8("invoice=<id>;note=<memo>")
```

钱包调用：

```text
Memo.memo(tokenAddress, transferData, memoId, memoData)
```

Arc 的 Memo 扩展会保留原始钱包发送者，并让内部代币转账与 Memo 事件处于同一笔交易中。交易失败时二者一起回滚。

## 5. 对账规则

索引器从持久化区块游标开始查询 `Memo` 事件，单次范围不超过 Arc RPC 的 10,000 区块限制。只有同时满足下列条件时才标记为已支付：

1. 事件来自 Arc 官方 Memo 合约。
2. `memoId` 等于发票 ID 的 Keccak-256。
3. `target` 等于发票币种的官方合约地址。
4. `callDataHash` 等于精确的收款地址与金额对应的转账 calldata 哈希。
5. 事件具备交易哈希和区块号。
6. `transactionHash + logIndex` 尚未被处理过。

付款人地址不做限制，因此任何钱包都可以代付。收款地址、币种和金额不可替换。

## 6. 安全约束

- 钱包在本地签名，应用不读取或存储私钥。
- 商户身份由一次性钱包签名 challenge 建立，不接受请求参数自报身份。
- 会话令牌只通过 `HttpOnly`、`SameSite=Lax` Cookie 传递，数据库仅保存 SHA-256 哈希。
- 所有带会话的写请求必须匹配配置的 `APP_ORIGIN`。
- 所有工作区 API 在服务端重新计算角色；owner 可管理成员和 Webhook，editor 可写发票，viewer 只读。
- 写交易前切换到固定 Chain ID `5042002`。
- 金额始终使用字符串和 `parseUnits`，避免浮点数参与链上编码。
- URL 数据执行类型、长度、地址、日期、币种和金额校验。
- 对账不只看相同 `memoId`，还校验目标合约与 calldata 哈希。
- 所有测试网提示保持可见，避免用户误认为是真实资产环境。
- Webhook 公开部署只接受 HTTPS，签名覆盖时间戳与原始请求体，并使用 outbox 幂等键。

## 7. 当前限制

- PGlite 只用于单进程本地 Alpha；多实例部署必须配置 `DATABASE_URL`。
- 托管 PostgreSQL 连接层已经完成，但当前工作区没有云数据库凭据，尚未进行目标供应商连通测试。
- 当前没有发票搜索筛选、完整报表、退款流程或 Webhook 死信重放界面。
- 当前团队成员由 owner 直接按地址添加，尚无邀请接受、工作区命名或多签审批流程。
- Webhook 已拒绝显式私网地址，但公开部署仍应配置出站代理或网络策略来抵御 DNS 重绑定。
- Memo 目前仅支持 EOA，Arc 官方文档说明智能合约钱包暂不支持该流程。
- 已用注资 EOA 完成 USDC 真实测试网端到端测试，EURC 尚待回归。

## 8. 迭代实施状态

### 8.1 已完成：数据与索引

- 增加 PostgreSQL 兼容数据库：`invoices`、`payments`、`indexer_cursors`。
- 增加只读 Arc indexer，按区块游标查询 Memo 事件。
- 使用 `txHash + logIndex` 做幂等键。
- 每次入账仍复用第一阶段的目标合约和 calldata 哈希校验。
- 增加随机短链接和旧浏览器数据自动迁移。

### 8.2 已完成：身份与后台任务

- 钱包签名 challenge、签名恢复校验、一次性消费和 7 天服务端会话。
- 发票 API 从会话解析商户，不再信任 URL 或 JSON 中的商户地址。
- 本地缓存按商户地址分区，避免切换钱包后显示上一账户的数据。
- `DATABASE_URL` 切换托管 PostgreSQL 连接池，开发环境继续使用 PGlite。
- 独立索引器进程、`invoice.paid` Webhook outbox、HMAC 签名和最多 8 次重试。

### 8.3 已完成：团队与运营工具

- 地址型工作区与 owner、editor、viewer 服务端权限矩阵。
- 工作区切换、团队成员添加/改权/移除和 Webhook 管理对话框。
- 受权限保护的 CSV 导出，并防护常见电子表格公式注入前缀。
- 团队成员撤销后立即失去工作区 API 访问权，不依赖会话过期。

### 8.4 产品能力

- 邀请接受、工作区命名和更细的角色策略。
- Webhook 投递记录与死信重放界面。
- 发票搜索和筛选。
- 过期、重复付款、部分付款和退款状态机。

### 8.5 跨链结算

- 接入 Circle App Kit 生成跨链 USDC 路由与交易计划。
- 保持 Arc 为最终结算链和统一对账来源。
- 在前端明确显示来源链、费用、预计到账和失败恢复步骤。

### 8.6 发布门槛

- 在已注资 EOA 上完成 USDC 与 EURC 真实测试网回归；当前 USDC 已通过，EURC 待完成。
- 桌面与移动端 E2E、钱包拒签、余额不足、RPC 失败全部覆盖。
- 公开部署启用安全响应头、错误监控、RPC 限流和可用性监控。
- 发布前重新核验 Arc 合约地址、App Kit 版本和官方测试网状态。
