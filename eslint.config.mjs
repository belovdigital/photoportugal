if (typeof globalThis.structuredClone !== "function") {
  globalThis.structuredClone = (value) => {
    if (value === null || typeof value !== "object") return value;
    if (value instanceof Date) return new Date(value);
    if (value instanceof RegExp) return new RegExp(value.source, value.flags);
    if (Array.isArray(value)) return value.map((item) => globalThis.structuredClone(item));

    const clone = {};
    for (const key of Reflect.ownKeys(value)) {
      clone[key] = globalThis.structuredClone(value[key]);
    }
    return clone;
  };
}

const [{ default: nextCoreWebVitals }, { default: nextTypescript }] = await Promise.all([
  import("eslint-config-next/core-web-vitals"),
  import("eslint-config-next/typescript"),
]);

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
