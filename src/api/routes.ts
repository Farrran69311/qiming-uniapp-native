import { http, isNativeWebViewRuntime } from "@/utils/http";

type Result = {
  success: boolean;
  data: Array<any>;
};

export const getAsyncRoutes = () => {
  if (isNativeWebViewRuntime() || import.meta.env.VITE_MOCK_SCOPE !== "all") {
    return Promise.resolve({
      success: true,
      data: []
    } satisfies Result);
  }

  return http.request<Result>(
    "get",
    "/get-async-routes",
    {},
    {
      baseURL: ""
    }
  );
};
