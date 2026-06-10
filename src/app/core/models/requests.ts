import { ActivityNode, ActivityPartition, ControlFlow } from './domain';

export interface DocumentRequirementRequest {
  name: string;
  description?: string;
  allowedMimeTypes?: string[];
  mandatory: boolean;
  uploadStage: string;
  uploaderRole: string;
  maxSizeBytes?: number | null;
}

export interface AssignDepartmentRequest {
  departmentId: string;
}

export interface CompleteTaskRequest {
  formData: Record<string, unknown>;
}

export interface CreateDepartmentRequest {
  name: string;
  description?: string;
}

export interface CreatePolicyRequest {
  name: string;
  description?: string;
  partitions: ActivityPartition[];
  nodes: ActivityNode[];
  flows: ControlFlow[];
  bpmnXml?: string; 
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LogoutRequest {
  refreshToken: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface StartProcessRequest {
  policyId: string;
  initialData?: Record<string, unknown>;
}

export interface UpdatePolicyRequest {
  name: string;
  description?: string;
  partitions: ActivityPartition[];
  nodes: ActivityNode[];
  flows: ControlFlow[];
  bpmnXml?: string;
}
