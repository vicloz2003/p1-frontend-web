import { ActivityNode, ActivityPartition, ControlFlow, DocumentRequirement } from './domain';
import { InstanceStatus, PolicyStatus, SystemRole, TaskStatus } from './enums';

export interface BottleneckResponse {
  nodeId: string;
  nodeLabel: string;
  averageDurationHours: number;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  userId: string;
  username: string;
  email: string;
  role: SystemRole;
  departmentId: string | null;
  expiresIn: number;
}

export interface NodeProgressItem {
  nodeId: string;
  nodeLabel: string;
  departmentName: string | null;
  status: 'PENDING' | 'CURRENT' | 'COMPLETED';
  completedAt: string | null;
}

export interface DocumentPermissions {
  canRead: string[] | null;
  canWrite: string[] | null;
  canDelete: string[] | null;
}

export interface DocumentVersion {
  versionId: string;
  uploadedBy: string;
  uploadedAt: string;
  sizeBytes: number;
}

export interface DocumentResponse {
  id: string;
  processInstanceId: string | null;
  businessPolicyId: string;
  documentRequirementId: string | null;
  fileName: string;
  mimeType: string;
  uploadedBy: string;
  uploadedByRole: string;
  status: 'PENDING_UPLOAD' | 'CONFIRMED' | 'DELETED';
  permissions: DocumentPermissions | null;
  uploadedAt: string;
  confirmedAt: string | null;
  taskId: string | null;
  versions: DocumentVersion[] | null;
}

export interface AuditLogResponse {
  id: string;
  documentId: string;
  processInstanceId: string | null;
  userId: string;
  userRole: string | null;
  action: 'VIEW' | 'DOWNLOAD' | 'UPLOAD' | 'REPLACE' | 'DELETE'
        | 'PERMISSION_CHANGE' | 'PERMISSION_CHECK_FAILED';
  timestamp: string;
  ipAddress: string | null;
  detail: string | null;
  userName: string | null;
}

export interface DocumentUploadInitiateResponse {
  documentId: string;
  s3Key: string;
  presignedUrl: string;
}

export interface PolicyResponse {
  id: string;
  name: string;
  description: string | null;
  createdBy: string;
  status: PolicyStatus;
  partitions: ActivityPartition[];
  nodes: ActivityNode[];
  flows: ControlFlow[];
  documentRequirements?: DocumentRequirement[];
  tags?: string[];
  bpmnXml?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProcessStatusResponse {
  processInstanceId: string;
  businessPolicyId: string;
  currentNodeId: string;
  currentNodeLabel: string | null;
  currentDepartmentId: string | null;
  currentDepartmentName: string | null;
  status: InstanceStatus;
  startedAt: string;
  completedAt: string | null;
  clientId: string | null;
  policyName: string;
  nodeProgress: NodeProgressItem[];
  progressPercent: number;
  pendingClientAction: string | null;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface RegisterResponse {
  accessToken: string;
  refreshToken: string;
  userId: string;
  username: string;
  email: string;
  role: SystemRole;
  departmentId: string | null;
  expiresIn: number;
}

export interface TaskNotificationDto {
  taskId: string;
  nodeId: string;
  nodeLabel: string;
  processInstanceId: string;
  policyName: string;
}

export interface TaskResponse {
  id: string;
  nodeId: string;
  nodeLabel: string;
  processInstanceId: string;
  assignedDepartmentId: string;
  status: TaskStatus;
  formSchema: Record<string, unknown>;
  assignedAt: string;
  claimedAt: string | null;
  policyName: string | null;
  clientName: string | null;
}

export interface UserResponse {
  id: string;
  username: string;
  email: string;
  role: SystemRole;
  departmentId: string | null;
}
