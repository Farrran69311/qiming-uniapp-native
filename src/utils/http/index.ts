import Axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type CustomParamsSerializer
} from "axios";
import type {
  PureHttpError,
  RequestMethods,
  PureHttpResponse,
  PureHttpRequestConfig
} from "./types.d";
import { stringify } from "qs";
import NProgress from "../progress";
import { getToken, formatToken } from "@/utils/auth";
import { useUserStoreHook } from "@/store/modules/user";

export const nativeApiBaseURL = "https://aiedu-api.intelledu.cn";

export function isNativeWebViewRuntime() {
  if (typeof window === "undefined") return false;

  const queryText = `${window.location.search}&${window.location.hash}`;
  return (
    queryText.includes("qimingNative=1") ||
    localStorage.getItem("qimingNativeWebView") === "1" ||
    sessionStorage.getItem("qimingNativeWebView") === "1" ||
    document.documentElement.classList.contains("qiming-native-webview")
  );
}

export function resolveApiBaseURL(
  baseURL = import.meta.env.VITE_API_URL || "/api"
) {
  if (isNativeWebViewRuntime() && (!baseURL || baseURL.startsWith("/"))) {
    return nativeApiBaseURL;
  }
  return baseURL;
}

export function resolveApiURL(
  path: string,
  params?: Record<string, unknown>,
  baseURL = import.meta.env.VITE_API_URL || "/api"
) {
  if (/^https?:\/\//i.test(path) || path.startsWith("//")) {
    return path;
  }

  const base = resolveApiBaseURL(baseURL).replace(/\/$/, "");
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    query.append(key, String(value));
  });
  const queryString = query.toString();

  return `${base}${path.startsWith("/") ? path : `/${path}`}${
    queryString ? `?${queryString}` : ""
  }`;
}

// 相关配置请参考：www.axios-js.com/zh-cn/docs/#axios-request-config-1
const defaultConfig: AxiosRequestConfig = {
  // 请求超时时间，上传大文件时设置为0表示不超时
  timeout: 0,
  // 设置基础URL（从环境变量读取，开发环境使用代理前缀，生产环境使用完整后端地址）
  baseURL: resolveApiBaseURL(),
  headers: {
    Accept: "application/json, text/plain, */*",
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest"
  },
  // 数组格式参数序列化（https://github.com/axios/axios/issues/5142）
  paramsSerializer: {
    serialize: stringify as unknown as CustomParamsSerializer
  }
};

const isNativeDemoPreview = () => {
  if (typeof window === "undefined") return false;

  const queryText = `${window.location.search}&${window.location.hash}`;
  const hasNativeFlag =
    queryText.includes("qimingNative=1") ||
    localStorage.getItem("qimingNativeWebView") === "1" ||
    sessionStorage.getItem("qimingNativeWebView") === "1" ||
    document.documentElement.classList.contains("qiming-native-webview");

  return hasNativeFlag && !!localStorage.getItem("qiming-demo-role");
};

class PureHttp {
  constructor() {
    this.httpInterceptorsRequest();
    this.httpInterceptorsResponse();
  }

  /** `token`过期后，暂存待执行的请求 */
  private static requests = [];

  /** 防止重复刷新`token` */
  private static isRefreshing = false;

  /** 初始化配置对象 */
  private static initConfig: PureHttpRequestConfig = {};

  /** 保存当前`Axios`实例对象 */
  private static axiosInstance: AxiosInstance = Axios.create(defaultConfig);

  /** 重连原始请求 */
  private static retryOriginalRequest(config: PureHttpRequestConfig) {
    return new Promise(resolve => {
      PureHttp.requests.push((token: string) => {
        config.headers["Authorization"] = formatToken(token);
        resolve(config);
      });
    });
  }

  /** 请求拦截 */
  private httpInterceptorsRequest(): void {
    PureHttp.axiosInstance.interceptors.request.use(
      async (config: PureHttpRequestConfig): Promise<any> => {
        // 开启进度条动画
        NProgress.start();
        // 优先判断post/get等方法是否传入回调，否则执行初始化设置等回调
        config.baseURL = resolveApiBaseURL(config.baseURL as string);
        if (typeof config.beforeRequestCallback === "function") {
          config.beforeRequestCallback(config);
        }
        if (PureHttp.initConfig.beforeRequestCallback) {
          PureHttp.initConfig.beforeRequestCallback(config);
        }
        /** 请求白名单，放置一些不需要`token`的接口（通过设置请求白名单，防止`token`过期后再请求造成的死循环问题） */
        const whiteList = ["/refresh-token", "/login"];
        const headers = config.headers as Record<string, any> | undefined;
        const hasExplicitAuthorization =
          !!headers?.Authorization || !!headers?.authorization;
        if (hasExplicitAuthorization) {
          return config;
        }
        return whiteList.some(url => config.url.endsWith(url))
          ? config
          : new Promise(resolve => {
              const data = getToken();
              if (data && data.accessToken) {
                const now = new Date().getTime();
                const expiresTime = Number(data.expires);
                // 只有在 expiresTime 有效且已过期时才尝试刷新
                // 增加对 NaN 的防御性处理，如果 expires 损坏则视为过期
                const expired = isNaN(expiresTime) || expiresTime - now <= 0;
                if (expired) {
                  if (!PureHttp.isRefreshing) {
                    PureHttp.isRefreshing = true;
                    // token过期刷新
                    useUserStoreHook()
                      .handRefreshToken({ refreshToken: data.refreshToken })
                      .then(res => {
                        const token = res?.data?.accessToken;
                        if (token) {
                          config.headers["Authorization"] = formatToken(token);
                          PureHttp.requests.forEach(cb => cb(token));
                        } else {
                          PureHttp.requests.forEach(cb => cb(""));
                        }
                        PureHttp.requests = [];
                      })
                      .catch(err => {
                        console.error("Token refresh failed:", err);
                        // 刷新失败则直接执行，让后端返回401
                        PureHttp.requests.forEach(cb => cb(""));
                        PureHttp.requests = [];
                      })
                      .finally(() => {
                        PureHttp.isRefreshing = false;
                      });
                  }
                  resolve(PureHttp.retryOriginalRequest(config));
                } else {
                  config.headers["Authorization"] = formatToken(
                    data.accessToken
                  );
                  resolve(config);
                }
              } else {
                // 无 Token 或 Token 损坏时直接发送请求，由后端/拦截器处理 401
                resolve(config);
              }
            });
      },
      error => {
        return Promise.reject(error);
      }
    );
  }

  /** 响应拦截 */
  private httpInterceptorsResponse(): void {
    const instance = PureHttp.axiosInstance;
    instance.interceptors.response.use(
      (response: PureHttpResponse) => {
        const $config = response.config;
        // 关闭进度条动画
        NProgress.done();
        // 优先判断post/get等方法是否传入回调，否则执行初始化设置等回调
        if (typeof $config.beforeResponseCallback === "function") {
          $config.beforeResponseCallback(response);
          return response.data;
        }
        if (PureHttp.initConfig.beforeResponseCallback) {
          PureHttp.initConfig.beforeResponseCallback(response);
          return response.data;
        }
        return response.data;
      },
      (error: PureHttpError) => {
        const $error = error;
        if ($error.response?.status === 401 && !isNativeDemoPreview()) {
          useUserStoreHook().logOut();
        }
        $error.isCancelRequest = Axios.isCancel($error);
        // 关闭进度条动画
        NProgress.done();
        // 所有的响应异常 区分来源为取消请求/非取消请求
        return Promise.reject($error);
      }
    );
  }

  /** 通用请求工具函数 */
  public request<T>(
    method: RequestMethods,
    url: string,
    param?: AxiosRequestConfig,
    axiosConfig?: PureHttpRequestConfig
  ): Promise<T> {
    const config = {
      method,
      url,
      ...param,
      ...axiosConfig
    } as PureHttpRequestConfig;

    // 单独处理自定义请求/响应回调
    return new Promise((resolve, reject) => {
      PureHttp.axiosInstance
        .request(config)
        .then((response: any) => {
          resolve(response);
        })
        .catch(error => {
          reject(error);
        });
    });
  }

  /** 单独抽离的`post`工具函数 */
  public post<T, P>(
    url: string,
    params?: AxiosRequestConfig<P>,
    config?: PureHttpRequestConfig
  ): Promise<T> {
    return this.request<T>("post", url, params, config);
  }

  /** 单独抽离的`get`工具函数 */
  public get<T, P>(
    url: string,
    params?: AxiosRequestConfig<P>,
    config?: PureHttpRequestConfig
  ): Promise<T> {
    return this.request<T>("get", url, params, config);
  }
}

export const http = new PureHttp();
