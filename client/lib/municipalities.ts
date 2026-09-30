export type Municipality = {
  id: string;
  code: string;
  name: string;
  province: string;
  type: string;
  active?: boolean;
  accessCodeConfigured?: boolean;
  reportCount?: number;
  staffCount?: number;
  boundarySource?: string;
  boundaryDataset?: string;
};

export type StaffMember = {
  id: string;
  name: string;
  email: string;
  role: "staff" | "super_admin";
  active?: boolean;
  municipalities: Municipality[];
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const payload = await response.json() as T & { message?: string };
  if (!response.ok) throw new Error(payload.message ?? "Municipality service is temporarily unavailable.");
  return payload;
}

export async function fetchStaffMunicipalities() {
  return request<{ municipalities: Municipality[]; verifiedMunicipalityId?: string }>("/api/staff/municipalities");
}

export async function verifyStaffMunicipality(municipalityId: string, accessCode: string) {
  return request<{ municipality: Municipality; message: string }>(
    `/api/staff/municipalities/${encodeURIComponent(municipalityId)}/verify-access`,
    { method: "POST", body: JSON.stringify({ accessCode }) },
  );
}

export async function lockStaffMunicipality() {
  return request<{ message: string }>("/api/staff/municipality/lock", { method: "POST" });
}

export async function fetchAdminMunicipalities() {
  return request<{ municipalities: Municipality[] }>("/api/admin/municipalities");
}

export async function fetchAdminStaff() {
  return request<{ staff: StaffMember[] }>("/api/admin/staff");
}

export async function assignStaffMunicipality(staffId: string, municipalityId: string) {
  return request<{ message: string }>(
    `/api/admin/staff/${encodeURIComponent(staffId)}/municipalities/${encodeURIComponent(municipalityId)}`,
    { method: "POST" },
  );
}

export async function removeStaffMunicipality(staffId: string, municipalityId: string) {
  return request<{ message: string }>(
    `/api/admin/staff/${encodeURIComponent(staffId)}/municipalities/${encodeURIComponent(municipalityId)}`,
    { method: "DELETE" },
  );
}

export async function generateMunicipalityAccessCode(municipalityId: string) {
  return request<{ accessCode: string; message: string }>(
    `/api/admin/municipalities/${encodeURIComponent(municipalityId)}/generate-access-code`,
    { method: "POST" },
  );
}

export async function fetchAdminMunicipalityReports(municipalityId: string) {
  return request<{ reports: import("@/types/issue").Issue[] }>(
    `/api/admin/reports?municipalityId=${encodeURIComponent(municipalityId)}`,
  );
}

export async function setMunicipalityActive(municipalityId: string, active: boolean) {
  return request<{ message: string }>(
    `/api/admin/municipalities/${encodeURIComponent(municipalityId)}/active`,
    { method: "PATCH", body: JSON.stringify({ active }) },
  );
}

export async function setStaffActive(staffId: string, active: boolean) {
  return request<{ message: string }>(
    `/api/admin/staff/${encodeURIComponent(staffId)}/active`,
    { method: "PATCH", body: JSON.stringify({ active }) },
  );
}

export async function bootstrapSuperAdmin(payload: {
  name: string;
  email: string;
  password: string;
  bootstrapToken: string;
}) {
  return request<{ user: { id: string; name: string; email: string; role: "super_admin" } }>(
    "/api/admin/bootstrap",
    { method: "POST", body: JSON.stringify(payload) },
  );
}