import { defineThemeLoader, toRuntimeTheme } from "@fullsnacklab/astro-theme/runtime";

export default defineThemeLoader(({ baseline }) => {
  const runtime = toRuntimeTheme(baseline);
  return {
    ...runtime,
    site: {
      ...runtime.site,
      name: "Runtime Theme Playground",
    },
  };
});
