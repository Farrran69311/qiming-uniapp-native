// @ts-check

/** @type {import("stylelint").Config} */
export default {
  extends: [
    "stylelint-config-standard",
    "stylelint-config-html/vue",
    "stylelint-config-recess-order"
  ],
  plugins: ["stylelint-scss", "stylelint-order", "stylelint-prettier"],
  overrides: [
    {
      files: ["**/*.(css|html|vue)"],
      customSyntax: "postcss-html"
    },
    {
      files: ["*.scss", "**/*.scss"],
      customSyntax: "postcss-scss",
      extends: [
        "stylelint-config-standard-scss",
        "stylelint-config-recommended-vue/scss"
      ]
    }
  ],
  rules: {
    "prettier/prettier": null,
    "selector-class-pattern": null,
    "no-descending-specificity": null,
    "no-duplicate-selectors": null,
    "block-no-empty": null,
    "keyframes-name-pattern": null,
    "color-function-notation": null,
    "alpha-value-notation": null,
    "value-keyword-case": null,
    "media-feature-range-notation": null,
    "declaration-block-no-shorthand-property-overrides": null,
    "declaration-block-no-redundant-longhand-properties": null,
    "declaration-block-no-duplicate-properties": null,
    "declaration-block-single-line-max-declarations": null,
    "shorthand-property-no-redundant-values": null,
    "font-family-name-quotes": null,
    "comment-empty-line-before": null,
    "comment-whitespace-inside": null,
    "declaration-empty-line-before": null,
    "custom-property-empty-line-before": null,
    "color-hex-length": null,
    "selector-not-notation": null,
    "selector-pseudo-element-colon-notation": null,
    "property-no-vendor-prefix": null,
    "function-no-unknown": [
      true,
      {
        ignoreFunctions: ["v-bind", "fade"]
      }
    ],
    "scss/dollar-variable-pattern": null,
    "selector-pseudo-class-no-unknown": [
      true,
      {
        ignorePseudoClasses: ["deep", "global"]
      }
    ],
    "selector-type-no-unknown": [
      true,
      {
        ignoreTypes: ["page"]
      }
    ],
    "selector-pseudo-element-no-unknown": [
      true,
      {
        ignorePseudoElements: ["v-deep", "v-global", "v-slotted"]
      }
    ],
    "at-rule-no-unknown": [
      true,
      {
        ignoreAtRules: [
          "tailwind",
          "apply",
          "variants",
          "responsive",
          "screen",
          "function",
          "if",
          "each",
          "for",
          "include",
          "mixin",
          "use"
        ]
      }
    ],
    "rule-empty-line-before": null,
    "unit-no-unknown": [true, { ignoreUnits: ["rpx"] }],
    "order/properties-order": null,
    "order/order": null
  },
  ignoreFiles: ["**/*.js", "**/*.ts", "**/*.jsx", "**/*.tsx", "report.html"]
};
