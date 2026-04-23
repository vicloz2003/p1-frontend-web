import { ActivityNode, ActivityPartition, ControlFlow } from './domain';
import { InstanceStatus, PolicyStatus, SystemRole, TaskStatus } from './enums';

export interface BottleneckResponse {
  nodeId: string;
  nodeLabel: string;
  averageDurationSeconds: number;
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

export interface PolicyResponse {
  id: string;
  name: string;
  description: string | null;
  createdBy: string;
  status: PolicyStatus;
  partitions: ActivityPartition[];
  nodes: ActivityNode[];
  flows: ControlFlow[];
  bpmnXml?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProcessStatusResponse {
  processInstanceId: string;
  currentNodeId: string;
  status: InstanceStatus;
  startedAt: string;
  clientId: string | null;
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
}

export interface UserResponse {
  id: string;
  username: string;
  email: string;
  role: SystemRole;
  departmentId: string | null;
}
