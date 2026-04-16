import { InstanceStatus, NodeType, PolicyStatus, SystemRole, TaskStatus } from './enums';

export interface ActivityPartition {
  id: string;
  label: string;
  departmentId: string;
}

export interface ActivityNode {
  id: string;
  label: string;
  partitionId: string;
  type: NodeType;
  formSchema: Record<string, unknown>;
  metadata: Record<string, string>;
}

export interface ControlFlow {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  guardCondition: string | null;
}

export interface ActivityTask {
  id: string;
  processInstanceId: string;
  nodeId: string;
  assignedDepartmentId: string;
  assignedUserId: string | null;
  status: TaskStatus;
  formData: Record<string, unknown>;
  assignedAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface Department {
  id: string;
  name: string;
  description: string | null;
}

export interface ProcessInstance {
  id: string;
  businessPolicyId: string;
  currentNodeId: string;
  initiatedBy: string;
  status: InstanceStatus;
  contextData: Record<string, unknown>;
  startedAt: string;
  completedAt: string | null;
}

export interface BusinessPolicy {
  id: string;
  name: string;
  description: string | null;
  createdBy: string;
  status: PolicyStatus;
  partitions: ActivityPartition[];
  nodes: ActivityNode[];
  flows: ControlFlow[];
  createdAt: string;
  updatedAt: string;
}

export interface RefreshToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  revoked: boolean;
}

export interface User {
  id: string;
  username: string;
  email: string;
  password: string;
  role: SystemRole;
  departmentId: string | null;
}
