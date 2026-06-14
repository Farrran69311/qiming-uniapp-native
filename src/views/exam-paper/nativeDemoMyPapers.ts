import {
  PaperStatus,
  type MyPaperStatistics,
  type PaperFolder,
  type PaperListItem
} from "@/api/examPaper";

export type NativeDemoMyPaperItem = PaperListItem & {
  folderId?: number;
  folderName?: string;
  updateTime: string;
  questionCount: number;
  publishCount: number;
};

export const nativeDemoMyPaperFolders: PaperFolder[] = [
  {
    id: 201,
    name: "嵌入式 Linux",
    paperCount: 0,
    createTime: "2026-05-28"
  },
  {
    id: 202,
    name: "高等数学",
    paperCount: 0,
    createTime: "2026-05-30"
  },
  {
    id: 203,
    name: "计算机基础",
    paperCount: 0,
    createTime: "2026-06-02"
  }
];

export const nativeDemoMyPaperList: NativeDemoMyPaperItem[] = [
  {
    paperId: 1,
    title: "嵌入式 Linux 开发阶段测验",
    courseName: "嵌入式 Linux",
    creatorName: "教师",
    status: PaperStatus.PUBLISHED,
    statusText: "已发布",
    timeLimit: 90,
    totalPoints: 100,
    totalQuestions: 24,
    questionCount: 24,
    participantCount: 42,
    submittedCount: 36,
    gradedCount: 30,
    publishCount: 3,
    folderId: 201,
    folderName: "嵌入式 Linux",
    createTime: "2026-06-08 09:20",
    updateTime: "2026-06-13 18:20"
  },
  {
    paperId: 2,
    title: "高等数学导数与极限练习",
    courseName: "高等数学",
    creatorName: "教师",
    status: PaperStatus.DRAFT,
    statusText: "草稿",
    timeLimit: 75,
    totalPoints: 80,
    totalQuestions: 18,
    questionCount: 18,
    participantCount: 0,
    submittedCount: 0,
    gradedCount: 0,
    publishCount: 0,
    folderId: 202,
    folderName: "高等数学",
    createTime: "2026-06-09 13:15",
    updateTime: "2026-06-12 15:40"
  },
  {
    paperId: 3,
    title: "计算机基础期末综合训练",
    courseName: "计算机基础",
    creatorName: "教师",
    status: PaperStatus.PUBLISHED,
    statusText: "已发布",
    timeLimit: 120,
    totalPoints: 120,
    totalQuestions: 30,
    questionCount: 30,
    participantCount: 58,
    submittedCount: 51,
    gradedCount: 47,
    publishCount: 2,
    folderId: 203,
    folderName: "计算机基础",
    createTime: "2026-06-04 10:00",
    updateTime: "2026-06-11 09:35"
  },
  {
    paperId: 4,
    title: "Linux 权限与进程管理小测",
    courseName: "嵌入式 Linux",
    creatorName: "教师",
    status: PaperStatus.DRAFT,
    statusText: "草稿",
    timeLimit: 45,
    totalPoints: 60,
    totalQuestions: 15,
    questionCount: 15,
    participantCount: 0,
    submittedCount: 0,
    gradedCount: 0,
    publishCount: 0,
    folderId: 201,
    folderName: "嵌入式 Linux",
    createTime: "2026-06-10 16:10",
    updateTime: "2026-06-10 19:05"
  },
  {
    paperId: 5,
    title: "线性代数矩阵运算随堂练习",
    courseName: "线性代数",
    creatorName: "教师",
    status: PaperStatus.PUBLISHED,
    statusText: "已发布",
    timeLimit: 60,
    totalPoints: 75,
    totalQuestions: 20,
    questionCount: 20,
    participantCount: 38,
    submittedCount: 35,
    gradedCount: 35,
    publishCount: 1,
    folderId: 202,
    folderName: "高等数学",
    createTime: "2026-06-06 08:45",
    updateTime: "2026-06-09 11:30"
  }
];

export const nativeDemoMyPaperStatistics: MyPaperStatistics = {
  total: nativeDemoMyPaperList.length,
  published: nativeDemoMyPaperList.filter(
    item => item.status === PaperStatus.PUBLISHED
  ).length,
  draft: nativeDemoMyPaperList.filter(item => item.status === PaperStatus.DRAFT)
    .length,
  recent: nativeDemoMyPaperList.filter(item =>
    item.updateTime.startsWith("2026-06")
  ).length
};
