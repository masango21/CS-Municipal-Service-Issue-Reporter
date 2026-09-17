export type IssuePriority = "Low" | "Medium" | "High" | "Critical";
export type IssueStatus =
  | "Reported"
  | "Under Review"
  | "Assigned"
  | "In Progress"
  | "Resolved"
  | "Closed";

export type IssueLocation = {
  latitude: number;
  longitude: number;
  address?: string;
  city?: string;
  municipality?: string;
};

export type Issue = {
  id: string;
  title: string;
  category: string;
  description: string;
  location: IssueLocation;
  priority: IssuePriority;
  status: IssueStatus;
  reportedBy: string;
  reportedAt: string;
  image?: string;
};

export type IssueDraft = Omit<Issue, "id" | "reportedAt" | "status"> & {
  status?: IssueStatus;
  reportedBy?: string;
};
