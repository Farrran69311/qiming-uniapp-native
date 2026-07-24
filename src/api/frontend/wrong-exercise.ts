import { http } from "@/utils/http";

// 对应文档 doc/frontend/wrong-exercise.md

export interface WrongExerciseAnalyzeRequest {
  course_id: number | string;
  original_exercise_id: string;
  original_exercise_content: string;
  student_answer: string;
  correct_answer: string;
}

export interface GeneratedExercise {
  exercise_id: string;
  question: string;
  options?: string[]; // 题干可能带选项
  correct_answer?: string;
  explanation?: string;
  difficulty_level?: string;
  knowledge_points?: string[];
}

export interface WrongExerciseAnalyzeResponse {
  analysis: {
    error_type: string;
    error_reason: string;
    knowledge_points: string[];
    learning_suggestions: string;
  };
  generated_exercises: GeneratedExercise[];
}

export interface WrongExerciseHistoryRecord {
  id: string;
  course_id: string | number;
  original_exercise_id: string;
  original_exercise_content: string;
  student_answer: string;
  correct_answer: string;
  analysis: WrongExerciseAnalyzeResponse["analysis"];
  generated_exercises: GeneratedExercise[];
  created_at: string;
  updated_at: string;
}

export interface WrongExerciseHistoryResponse {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  records: WrongExerciseHistoryRecord[] | null;
}

export interface ApiResp<T = any> {
  code?: number; // 与其他模块保持兼容
  msg?: string;
  data?: T;
}

export const analyzeWrongExercise = (data: WrongExerciseAnalyzeRequest) => {
  return http.request<ApiResp<WrongExerciseAnalyzeResponse>>(
    "post",
    "/edu/frontend/v1/ai/wrong-exercise/analyze",
    { data }
  );
};

export const getWrongExerciseHistory = (params: {
  course_id?: number | string;
  page?: number;
  page_size?: number;
}) => {
  return http.request<ApiResp<WrongExerciseHistoryResponse>>(
    "get",
    "/edu/frontend/v1/ai/wrong-exercise/history",
    { params }
  );
};
