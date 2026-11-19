# Antigravity 后台唤醒续跑

## 背景与决定

Antigravity ACP 在后台命令（`run_command` 转异步任务）尚未结束、Agent 停止继续调用工具时，会先对当前 `session/prompt` 返回 `stopReason: "end_turn"`。随后后台任务完成并唤醒 Agent 时，Antigravity 会继续通过同一条 ACP 会话主动推送 `session/update` 通知（例如完成后的 `tool_call_update`、唤醒回复的 `agent_message_chunk` 和 `usage_update`）。

上游的通用 ACP Adapter 已经实现了 `enablePostSettleContinuation`（在 turn 结束后缓存这类唤醒通知，并通过 `continuationRequests` 发起无需再次 `session/prompt` 的 provider continuation turn，把输出推回界面），Grok 与 Copilot 等 ACP 驱动也已启用；但 [AntigravityAdapterV2.ts](../../apps/server/src/orchestration-v2/Adapters/AntigravityAdapterV2.ts) 未开启 `enablePostSettleContinuation`。结果是后台任务完成后，唤醒回复虽然写进了 Antigravity 自己的会话历史，却在 T3 Code 侧被丢弃，用户界面一直停在上一轮结束态，直到下一次手动发消息。

同时，通用 ACP Adapter 中 `scheduleDeferredFinalize` 与 `rearmDeferredFinalize` 原本仅在 `flavor.deferFinalizeForBackgroundWork === true` 时生效。Antigravity 使用 ACP v1（无 `state_update` 前台空闲事件），且需要保留 `subagentsIdleOnTurnCompletion: true` 让原生只读子代理随普通 turn 结束，不能为普通 turn 开启 `deferFinalizeForBackgroundWork`。因此只对已开启 `enablePostSettleContinuation` 的 provider continuation turn 放开延迟收尾防抖，普通 turn 行为保持不变。

## 行为约定

- Antigravity 普通 turn 与原生子代理的结束时机保持与上游一致，不受延迟收尾影响。
- 当 `session/prompt` 已返回 `end_turn` 后，若 Antigravity 因后台任务完成继续推送 `tool_call_update`（完成/失败）或 `agent_message_chunk`：
  - ACP Adapter 缓存唤醒通知并向编排层提交 provider continuation 请求；
  - continuation turn 消费缓存和后续流式通知，不重复发送 `session/prompt`；
  - 流式输出静默超过防抖窗口后，continuation turn 自动正常结束（`completed`）。

## 修改方式

- [AntigravityAdapterV2.ts](../../apps/server/src/orchestration-v2/Adapters/AntigravityAdapterV2.ts)：在 `makeAntigravityAcpAdapterFlavor` 中启用 `enablePostSettleContinuation: true`。
- [adapter.ts](../../packages/provider-acp/src/server/adapter.ts)：在 `rearmDeferredFinalize` 与 `scheduleDeferredFinalize` 中允许开启了 `postSettleContinuationEnabled` 的 provider continuation turn 使用延迟收尾防抖，避免 ACP v1 驱动在 continuation turn 消费完唤醒消息后无法自动结束。
- [AntigravityAdapterV2.test.ts](../../apps/server/src/orchestration-v2/Adapters/AntigravityAdapterV2.test.ts)：补充 post-settle 后台唤醒续跑单测，覆盖 `tool_call_update` + `agent_message_chunk` 触发 continuation、不重复 `session/prompt`、以及自动结束。

## 验证方式

- 运行 [AntigravityAdapterV2.test.ts](../../apps/server/src/orchestration-v2/Adapters/AntigravityAdapterV2.test.ts) 与 `vp run check:changed v0.1.10`。
- 在安装包中使用 Antigravity 发起超过 10 秒自动转后台的命令并在当前 turn 结束等待，确认后台命令结束后界面自动续跑并展示完整结果。

## 移除条件

上游为 Antigravity ACP 启用 `enablePostSettleContinuation`（或通过 ACP v2 `state_update` / 原生后台续跑机制接管 `end_turn` 后的唤醒输出）并经实测确认界面自动展示后台唤醒回复后，不再迁移本补丁。
