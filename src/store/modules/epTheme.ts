import { defineStore } from "pinia";
import {
  store,
  getConfig,
  storageLocal,
  responsiveStorageNameSpace
} from "../utils";

const defaultEpThemeColor = "#97b4f7";
const getEpThemeColor = () => getConfig().EpThemeColor || defaultEpThemeColor;
const getLayoutTheme = () => getConfig().Theme || "light";

export const useEpThemeStore = defineStore("pure-epTheme", {
  state: () => ({
    epThemeColor:
      storageLocal().getItem<StorageConfigs>(
        `${responsiveStorageNameSpace()}layout`
      )?.epThemeColor ?? getEpThemeColor(),
    epTheme:
      storageLocal().getItem<StorageConfigs>(
        `${responsiveStorageNameSpace()}layout`
      )?.theme ?? getLayoutTheme()
  }),
  getters: {
    getEpThemeColor(state) {
      return state.epThemeColor;
    },
    /** 用于mix导航模式下hamburger-svg的fill属性 */
    fill(state) {
      if (state.epTheme === "light") {
        return "#97b4f7";
      } else {
        return "#fff";
      }
    }
  },
  actions: {
    setEpThemeColor(newColor: string): void {
      const layout = storageLocal().getItem<StorageConfigs>(
        `${responsiveStorageNameSpace()}layout`
      );
      this.epTheme = layout?.theme;
      this.epThemeColor = newColor;
      if (!layout) return;
      layout.epThemeColor = newColor;
      storageLocal().setItem(`${responsiveStorageNameSpace()}layout`, layout);
    }
  }
});

export function useEpThemeStoreHook() {
  return useEpThemeStore(store);
}
