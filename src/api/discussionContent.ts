import MarkdownIt from "markdown-it";

const allowedLinkProtocols = new Set(["http", "https", "mailto", "tel"]);

const decodeLinkForValidation = (value: string) => {
  let decoded = value;

  for (let index = 0; index < 3; index += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      return "";
    }
  }

  return decoded.replace(/[\u0000-\u0020\u007f-\u009f]/g, "");
};

export const isSafeDiscussionLink = (value: string) => {
  const normalized = decodeLinkForValidation(value.trim());
  if (!normalized || /^(?:\/\/|\\\\)/.test(normalized)) return false;

  const scheme = /^([a-z][a-z\d+.-]*):/i.exec(normalized)?.[1];
  return !scheme || allowedLinkProtocols.has(scheme.toLowerCase());
};

const discussionMarkdownRenderer = new MarkdownIt({
  html: false,
  breaks: true,
  linkify: false,
  typographer: false
});

discussionMarkdownRenderer.validateLink = isSafeDiscussionLink;

export const renderDiscussionContent = (content: unknown) =>
  discussionMarkdownRenderer.render(typeof content === "string" ? content : "");
