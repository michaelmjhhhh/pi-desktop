import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

const eslintConfig = [
  { ignores: [".desktop/**", ".next-desktop/**", "dist/**"] },
  ...coreWebVitals,
  ...typescript,
  // Existing lifecycle/render patterns need separate behavioral review before
  // these rules can be enabled here. Other and new files retain strict defaults.
  {
    files: [
      "components/ChatMinimap.tsx",
      "components/MessageView.tsx",
      "components/ModelsConfig.tsx",
      "components/TerminalPanel.tsx",
    ],
    rules: { "react-hooks/refs": "off" },
  },
  {
    files: [
      "components/ChatWindow.tsx",
      "components/FileViewer.tsx",
      "components/ModelSelector.tsx",
      "components/ModelsConfig.tsx",
      "components/SessionSidebar.tsx",
      "components/SettingsPanel.tsx",
      "components/ToolDefinitionsPanel.tsx",
      "hooks/useI18n.tsx",
      "hooks/useResizablePanel.ts",
    ],
    rules: { "react-hooks/set-state-in-effect": "off" },
  },
];

export default eslintConfig;
