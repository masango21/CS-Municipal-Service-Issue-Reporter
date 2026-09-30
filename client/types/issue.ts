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
  municipalityId?: string;
  province?: string;
  municipalityType?: string;
  geocodingAttribution?: string;
};

export type StaffNote = {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: string;
};

export type ResidentStatusUpdate = {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  status: IssueStatus;
  createdAt: string;
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
  verified?: boolean;
  verifiedAt?: string;
  verifiedBy?: string;
  department?: string;
  maintenanceTeam?: string;
  assignedStaffId?: string;
  assignedStaffName?: string;
  staffNotes?: StaffNote[];
  residentUpdates?: ResidentStatusUpdate[];
  duplicateOf?: string;
  duplicateReports?: Array<{ id: string; title: string }>;
};

export type IssueDraft = Omit<Issue, "id" | "reportedAt" | "status"> & {
  status?: IssueStatus;
  reportedBy?: string;
};
