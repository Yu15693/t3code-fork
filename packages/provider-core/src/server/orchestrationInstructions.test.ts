import { assert, describe, it } from "@effect/vitest";

import {
  T3_CODE_BROWSER_TOOL_INSTRUCTIONS,
  T3_CODE_DEVICE_TOOL_INSTRUCTIONS,
  T3_CODE_DEVICE_TOOL_INSTRUCTIONS_WITH_TOOL_SEARCH,
  T3_CODE_ORCHESTRATION_INSTRUCTIONS,
  t3AcpPromptWithInstructions,
  t3OrchestrationPrompt,
  t3OrchestrationSystemPrompt,
} from "./orchestrationInstructions.ts";

describe("T3 device instructions", () => {
  it("route device work through device_open and give Claude the line that loads the tools", () => {
    for (const intent of ["`device_list`", "`device_open`", "`agent-device`", "ssh", "`hostId`"]) {
      assert.include(T3_CODE_DEVICE_TOOL_INSTRUCTIONS, intent);
    }
    assert.notInclude(T3_CODE_DEVICE_TOOL_INSTRUCTIONS, "ToolSearch");
    const loadLine =
      " Load them with ToolSearch `select:mcp__t3-code__device_list,mcp__t3-code__device_open,mcp__t3-code__device_screenshot,mcp__t3-code__device_close`.";
    assert.include(T3_CODE_DEVICE_TOOL_INSTRUCTIONS_WITH_TOOL_SEARCH, loadLine);
    assert.equal(
      T3_CODE_DEVICE_TOOL_INSTRUCTIONS_WITH_TOOL_SEARCH.replace(loadLine, ""),
      T3_CODE_DEVICE_TOOL_INSTRUCTIONS,
    );
  });

  it("open the app before the returned command's snapshots, screenshots and input", () => {
    assert.include(
      T3_CODE_DEVICE_TOOL_INSTRUCTIONS,
      "its snapshots, screenshots and input need `open <app>` first,",
    );
  });

  it("keep the failure rule from taking over or closing a session another thread holds", () => {
    // agent-device's DEVICE_IN_USE advice is to rerun with the owner's --session or close it first.
    assert.include(
      T3_CODE_DEVICE_TOOL_INSTRUCTIONS,
      "follow its advice once, but never reuse or close another session; if it still fails,",
    );
  });

  it("reach OpenCode and Cursor only when the session holds device access", () => {
    assert.include(t3OrchestrationSystemPrompt(true, true), T3_CODE_DEVICE_TOOL_INSTRUCTIONS);
    assert.notInclude(t3OrchestrationSystemPrompt(true, false), "## T3 Code devices");
    assert.isUndefined(t3OrchestrationSystemPrompt(false, true));

    const firstRun = (hasDeviceTools: boolean) =>
      t3OrchestrationPrompt({
        prompt: "Check the login screen.",
        hasT3Mcp: true,
        hasDeviceTools,
        orchestrationDelivered: false,
        deviceInstructionsDelivered: false,
      });
    assert.include(firstRun(true), T3_CODE_DEVICE_TOOL_INSTRUCTIONS);
    assert.notInclude(firstRun(false), "## T3 Code devices");

    const laterRun = (deviceInstructionsDelivered: boolean) =>
      t3OrchestrationPrompt({
        prompt: "Check the login screen.",
        hasT3Mcp: true,
        hasDeviceTools: true,
        orchestrationDelivered: true,
        deviceInstructionsDelivered,
      });
    assert.include(laterRun(false), T3_CODE_DEVICE_TOOL_INSTRUCTIONS);
    assert.notInclude(laterRun(false), T3_CODE_ORCHESTRATION_INSTRUCTIONS.trim());
    assert.equal(laterRun(true), "Check the login screen.");
  });

  it("reach ACP agents again when device access changes mid-thread", () => {
    const state = {
      interactionMode: "default",
      hasT3Mcp: true,
      hasBrowserTools: false,
      hasDeviceTools: false,
    } as const;
    const withDevices = t3AcpPromptWithInstructions({
      prompt: "Check the login screen.",
      state: { ...state, hasDeviceTools: true },
      previousState: state,
    });
    assert.include(withDevices, T3_CODE_DEVICE_TOOL_INSTRUCTIONS);
    assert.equal(
      t3AcpPromptWithInstructions({ prompt: "Again.", state, previousState: state }),
      "Again.",
    );
    assert.notInclude(t3AcpPromptWithInstructions({ prompt: "Hi.", state }), "## T3 Code devices");
  });
});

describe("T3 browser instructions", () => {
  it("keep preview_* rules out of shared orchestration instructions", () => {
    assert.notInclude(T3_CODE_ORCHESTRATION_INSTRUCTIONS, "preview_*");
    assert.include(T3_CODE_BROWSER_TOOL_INSTRUCTIONS, "## T3 Code browser");
    assert.include(T3_CODE_BROWSER_TOOL_INSTRUCTIONS, "preview_*");
  });

  it("gate browser instructions by hasBrowserTools for ACP, OpenCode and Cursor", () => {
    const withoutBrowser = {
      interactionMode: "default",
      hasT3Mcp: true,
      hasBrowserTools: false,
      hasDeviceTools: false,
    } as const;
    const acpNoBrowser = t3AcpPromptWithInstructions({
      prompt: "Check page.",
      state: withoutBrowser,
    });
    assert.notInclude(acpNoBrowser, "## T3 Code browser");
    assert.notInclude(acpNoBrowser, "preview_*");

    const acpWithBrowser = t3AcpPromptWithInstructions({
      prompt: "Check page.",
      state: { ...withoutBrowser, hasBrowserTools: true },
      previousState: withoutBrowser,
    });
    assert.include(acpWithBrowser, T3_CODE_BROWSER_TOOL_INSTRUCTIONS.trim());

    assert.include(t3OrchestrationSystemPrompt(true, false, true), "## T3 Code browser");
    assert.notInclude(t3OrchestrationSystemPrompt(true, false, false), "preview_*");

    const cursorNoBrowser = t3OrchestrationPrompt({
      prompt: "Check page.",
      hasT3Mcp: true,
      hasBrowserTools: false,
      hasDeviceTools: false,
      orchestrationDelivered: false,
      browserInstructionsDelivered: false,
      deviceInstructionsDelivered: false,
    });
    assert.notInclude(cursorNoBrowser, "preview_*");

    const cursorWithBrowser = t3OrchestrationPrompt({
      prompt: "Check page.",
      hasT3Mcp: true,
      hasBrowserTools: true,
      hasDeviceTools: false,
      orchestrationDelivered: false,
      browserInstructionsDelivered: false,
      deviceInstructionsDelivered: false,
    });
    assert.include(cursorWithBrowser, T3_CODE_BROWSER_TOOL_INSTRUCTIONS.trim());
  });
});
