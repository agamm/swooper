import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

// eslint-config-next v16 ships native flat configs. Routing them through
// FlatCompat instead makes ESLint 9 fail while merely loading the config.
const eslintConfig = [
  ...coreWebVitals,
  ...typescript,
  {
    ignores: [".next/**", "node_modules/**"],
  },
  {
    rules: {
      // The app fetches and syncs external state from effects throughout. That
      // costs an extra render but is not incorrect, so it stays visible as a
      // warning instead of blocking lint on a full data-layer refactor.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  {
    // A plain Node build script, not part of the bundle.
    files: ["scripts/**/*.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
];

export default eslintConfig;
