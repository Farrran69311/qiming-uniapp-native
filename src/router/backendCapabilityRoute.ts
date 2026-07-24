import {
  defineAsyncComponent,
  defineComponent,
  h,
  onBeforeUnmount,
  onMounted,
  ref,
  useAttrs,
  type Component
} from "vue";
import { http } from "@/utils/http";
import BackendCapabilityUnavailable from "@/components/BackendCapabilityUnavailable.vue";
import { assertCapabilityProbeSucceeded } from "./backendCapabilityResponse";

type CapabilityStatus = "checking" | "available" | "unavailable";

interface BackendCapabilityOptions {
  name: string;
  title: string;
  moduleName: string;
  probePaths: string[];
  kind?: "exam" | "competition";
  fallbackPath?: string;
}

const capabilityCache = new Map<
  string,
  Exclude<CapabilityStatus, "checking">
>();

export function withBackendCapability(
  loader: () => Promise<{ default: Component }>,
  options: BackendCapabilityOptions
) {
  const PageComponent = defineAsyncComponent(loader);
  const cacheKey = [...options.probePaths].sort().join("|");

  return defineComponent({
    name: options.name,
    inheritAttrs: false,
    setup() {
      const attrs = useAttrs();
      const status = ref<CapabilityStatus>(
        capabilityCache.get(cacheKey) || "checking"
      );
      let active = true;

      const checkCapability = async (force = false) => {
        if (!force) {
          const cached = capabilityCache.get(cacheKey);
          if (cached) {
            status.value = cached;
            return;
          }
        }

        status.value = "checking";
        try {
          await Promise.all(
            options.probePaths.map(path =>
              http
                .request("get", path, { timeout: 8000 })
                .then(assertCapabilityProbeSucceeded)
            )
          );
          if (!active) return;
          capabilityCache.set(cacheKey, "available");
          status.value = "available";
        } catch {
          if (!active) return;
          capabilityCache.set(cacheKey, "unavailable");
          status.value = "unavailable";
        }
      };

      onMounted(() => checkCapability());
      onBeforeUnmount(() => {
        active = false;
      });

      return () =>
        status.value === "available"
          ? h(PageComponent, attrs)
          : h(BackendCapabilityUnavailable, {
              ...attrs,
              title: options.title,
              moduleName: options.moduleName,
              kind: options.kind,
              checking: status.value === "checking",
              fallbackPath: options.fallbackPath,
              onRetry: () => checkCapability(true)
            });
    }
  });
}
