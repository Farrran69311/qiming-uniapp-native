import { reactive } from "vue";
import type { FormRules } from "element-plus";
import { $t, transformI18n } from "@/plugins/i18n";

/** 密码正则（密码格式应为8-18位数字、字母、符号的任意两种组合） */
export const REGEXP_PWD =
  /^(?![0-9]+$)(?![a-z]+$)(?![A-Z]+$)(?!([^(0-9a-zA-Z)]|[()])+$)(?!^.*[\u4E00-\u9FA5].*$)([^(0-9a-zA-Z)]|[()]|[a-z]|[A-Z]|[0-9]){8,18}$/;

/** 登录校验 */
const loginRules = reactive<FormRules>({
  username: [
    {
      validator: (_rule, value, callback) => {
        if (!value) {
          callback(new Error("请输入手机号"));
        } else if (!/^1[3-9]\d{9}$/.test(String(value).trim())) {
          callback(new Error("请输入正确的手机号"));
        } else {
          callback();
        }
      },
      trigger: "blur"
    }
  ],
  password: [
    {
      validator: (_rule, value, callback) => {
        if (value === "") {
          callback(new Error(transformI18n($t("login.purePassWordReg"))));
        } else {
          callback();
        }
      },
      trigger: "blur"
    }
  ]
});

export { loginRules };
