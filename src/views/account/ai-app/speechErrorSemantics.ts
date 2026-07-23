export const SPEECH_SEGMENT_QUOTA_DENIED =
  "speech_segment_quota_denied" as const;

const segmentErrorMessages: Readonly<Record<string, string>> = {
  [SPEECH_SEGMENT_QUOTA_DENIED]: "今日实时语音额度不足，文字回答不受影响"
};

export const speechSegmentErrorMessage = (
  errorCode: string | undefined,
  fallback: string
) => (errorCode ? segmentErrorMessages[errorCode] : undefined) || fallback;
