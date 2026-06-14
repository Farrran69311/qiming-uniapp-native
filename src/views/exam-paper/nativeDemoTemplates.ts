import type { SystemTemplateStats } from "@/api/examPaper";

export { nativeDemoSystemTemplateStats } from "@/views/exam-paper/nativeDemoOverview";

export type NativeDemoTemplateItem = {
  id: number;
  name: string;
  description?: string;
  questionTypes: string[];
  totalQuestions: number;
  totalPoints: number;
  createTime: string;
};

export const nativeDemoMyTemplates: NativeDemoTemplateItem[] = [
  {
    id: 301,
    name: "嵌入式 Linux 阶段测验模板",
    description: "适合章节学习后的课堂测验，覆盖权限、进程与 Shell 基础。",
    questionTypes: ["单选题", "多选题", "填空题"],
    totalQuestions: 18,
    totalPoints: 80,
    createTime: "2026-06-10"
  },
  {
    id: 302,
    name: "高等数学错题复盘模板",
    description: "围绕导数、极限和积分的错题复盘，保留简答题讲解空间。",
    questionTypes: ["单选题", "填空题", "简答题"],
    totalQuestions: 16,
    totalPoints: 75,
    createTime: "2026-06-11"
  },
  {
    id: 303,
    name: "计算机基础期末回顾模板",
    description: "面向期末复习的综合训练，适合快速生成练习卷。",
    questionTypes: ["判断题", "单选题", "简答题"],
    totalQuestions: 22,
    totalPoints: 100,
    createTime: "2026-06-12"
  }
];

export const cloneNativeDemoMyTemplates = () =>
  JSON.parse(JSON.stringify(nativeDemoMyTemplates)) as NativeDemoTemplateItem[];

export const applyTemplateStatsToList = <
  T extends {
    templateKey: string;
    totalQuestions?: number;
    totalPoints?: number;
    useCount?: number;
  }
>(
  target: T[],
  stats: SystemTemplateStats[]
) => {
  stats.forEach(stat => {
    const template = target.find(item => item.templateKey === stat.templateKey);
    if (!template) return;

    template.totalQuestions = stat.questionCount;
    template.totalPoints = stat.totalPoints;
    template.useCount = stat.useCount;
  });
};
