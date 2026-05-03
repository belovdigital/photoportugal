import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const generatedAndLocalFiles = [
  ".next/**",
  "node_modules/**",
  "public/**",
  "uploads/**",
  "tsconfig.tsbuildinfo",
  "*.png",
  "*.jpg",
  "*.jpeg",
];

const typescriptRuleOverrides = {
  "@typescript-eslint/no-explicit-any": "warn",
  "@typescript-eslint/no-require-imports": "off",
  "prefer-const": "warn",
};

function nextOverridesFor(entry) {
  return {
    "prefer-const": "warn",
    ...(entry.plugins?.["@next/next"] ? { "@next/next/no-html-link-for-pages": "warn" } : {}),
    ...(entry.plugins?.react ? { "react/no-unescaped-entities": "warn" } : {}),
    ...(entry.plugins?.["react-hooks"]
      ? {
        "react-hooks/globals": "off",
        "react-hooks/immutability": "off",
        "react-hooks/purity": "off",
        "react-hooks/set-state-in-effect": "off",
      }
      : {}),
  };
}

const config = [
  ...nextCoreWebVitals.map((entry) => ({
    ...entry,
    rules: {
      ...entry.rules,
      ...nextOverridesFor(entry),
    },
  })),
  ...nextTypescript.map((entry) => ({
    ...entry,
    rules: {
      ...entry.rules,
      ...typescriptRuleOverrides,
    },
  })),
  {
    ignores: generatedAndLocalFiles,
  },
];

export default config;
