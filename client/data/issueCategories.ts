export const issueCategories = [
  "Pothole",
  "Water Leak",
  "Burst Pipe",
  "Broken Streetlight",
  "Damaged Road",
  "Illegal Dumping",
  "Blocked Drain",
  "Sewer Problem",
  "Traffic Signal Problem",
  "Electrical Infrastructure",
  "Other Municipal Issue",
] as const;

export type IssueCategory = (typeof issueCategories)[number];
