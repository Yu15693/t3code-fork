# Fork 维护

这里维护 [Yu15693/t3code-fork](https://github.com/Yu15693/t3code-fork) 的自用约定。开发环境和工程规则沿用 [AGENTS.md](../AGENTS.md)；处理具体补丁时，再阅读下方对应的 Spec。

## 基线与分支

当前基线为上游 [`v0.1.7`](https://github.com/pingdotgg/t3code/releases/tag/v0.1.7)，提交 `322f6544dfad0a3c8a0c8cbecf2c7f7874b14268`。目标是本机 macOS 桌面版，按需要维护少量补丁，手动选择升级时机；当前不使用 T3 Connect。

| 对象                     | 用途                                                      |
| ------------------------ | --------------------------------------------------------- |
| `origin`                 | 自己的 Fork：`https://github.com/Yu15693/t3code-fork.git` |
| `upstream`               | 官方仓库：`https://github.com/pingdotgg/t3code.git`       |
| `main`                   | 仅从 `upstream/main` 快进同步，保留干净的上游参考         |
| `release/yu`             | 选定的稳定版及仍需要的自用提交                            |
| `upgrade/yu-…`           | 在同一 checkout 中验证下一次升级的临时分支                |
| `yu/v0.1.7-1` 等自用标签 | 固定已验证的构建，末尾序号区分同一基线下的发布            |

上游标签按需获取，例如 `git fetch --no-tags upstream tag v0.1.7`，保持原名和指向。自用 Git 标签与应用版本号分别记录；发布后不移动标签，也不使用 `git push --tags` 批量推送上游标签。启用 Fork 的 Actions 前检查继承的 [release workflow](../.github/workflows/release.yml)，其中的定时任务和 `v*.*.*` 触发器需要单独适配。

## 补丁说明

Spec 放在 `specs/YYYY-MM-DD-简洁中文主题.md`，日期为首次创建日期。每份记录一个明确变化的背景、目标、范围、取舍、状态、验证方式和移除条件；实现后在原文件补充结果及提交或验证记录的引用。目标或方案发生实质变化时新建 Spec 并关联旧记录。

| 补丁                                                     | 说明                                                         |
| -------------------------------------------------------- | ------------------------------------------------------------ |
| [浏览器工具选择](specs/2026-11-09-浏览器工具选择.md)     | 优先使用用户指定的方式，未指定时默认使用可用的 T3 浏览器工具 |
| [自用构建禁用更新](specs/2026-11-09-自用构建禁用更新.md) | 保持手动升级，避免自建包被自动替换                           |

状态与验证结论以各 Spec 为准，此处只维护索引。新增补丁前核对已有配置和上游 issue/PR；每个独立问题单独提交，允许同一问题后续补修。提交说明记录实际行为、依赖和验证，使用 Conventional Commits。Spec 保存需求与决策，Git 保存实现差异，运行日志和二进制留在本地或发布产物中。

## 同步与升级

每隔几周查看官方稳定版发布说明，按需要决定升级；重要安全修复可以提前处理。同步 `main` 不会自动升级 `release/yu`，自用分支不直接跟随最新 `main` 或 Nightly。

1. 确认工作区和暂存区干净，获取选定的上游稳定 tag。更新参考分支时仅快进合并 `upstream/main`；快进失败先核对差异，不强制重置。
2. 为旧 `release/yu` 建立本地备份分支，保留旧安装包和发布标签。检查旧基线到自用分支的提交及对应 Spec，选出仍需要的补丁。
3. 从新 tag 创建升级分支，按依赖顺序 cherry-pick 保留的提交，包括维护文档和 Agent 入口。上游已解决的补丁在验证相同行为后移除，Spec 保留结论和移除依据。
4. 解决冲突，更新本页基线和受影响的 Spec，执行相关检查与安装包验证。用 `git range-diff` 对比新旧补丁范围，确认没有遗漏或意外改变。
5. 验证通过且旧分支没有并行新增提交后，将本地 `release/yu` 指向升级结果。远端更新按当前授权执行；重放后需要改写远端历史时，核对旧 SHA 并使用带明确旧 SHA 的 `--force-with-lease`，失败则重新核对。已发布标签保持不动。

升级未通过时继续使用旧版本，保留升级分支供后续处理，不发布新标签。

## 构建、验证与恢复

- 环境与依赖按 [开发指南](../docs/operations/development.md#first-checkout) 准备，版本以 [package.json](../package.json) 和锁文件为准。macOS 打包入口为 `vp run dist:desktop:dmg`，系统依赖、默认未作发行签名的行为及产物位置见 [Desktop artifacts](../docs/operations/development.md#desktop-artifacts)。
- 文档只检查入口、链接和命令来源。功能改动执行 [相关验证](../AGENTS.md#verifying)；推送前运行 `vp run check:changed v0.1.7`，升级后将参数替换为当前基线。运行时指令变更还需按 [evals 指南](../evals/README.md) 验证模型行为。
- 每份准备安装的产物记录上游 tag、自用提交 SHA、应用版本、构建环境与命令、校验值和验证结果。实际检查安装包启动、后台服务来源及对应 Spec 的目标行为；开发进程通过不能代替安装包验证。
- 首次验证使用独立目录和测试数据，真实数据副本按 [Test data](../AGENTS.md#test-data) 准备。`T3CODE_HOME` 只控制服务状态，不能隔离 [Electron 资料目录](../apps/desktop/src/app/DesktopUserData.ts)；并行试用还需核对应用身份和实际服务连接。
- 替换日常版本前，确认活动任务可中断，停止相关应用与服务，备份完整 T3 home 和实际 Electron 资料目录，保留旧安装包。凭据和会话备份仅本地保存；运行时只复制 SQLite 主文件不能充当完整备份。
- 仍需补丁就继续基于新稳定 tag 构建；官方已满足全部需要时，用数据副本验证兼容后切回官方应用和服务。数据迁移未必可逆，恢复时使用相匹配的旧安装包与升级前备份，并明确备份后的新记录会丢失。详见 [Updating T3 Code](../docs/user/updating.md)。
