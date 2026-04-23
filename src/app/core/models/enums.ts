export type NodeType =
  | 'INITIAL_NODE'
  | 'ACTION'
  | 'DECISION'
  | 'MERGE'
  | 'FORK'
  | 'JOIN'
  | 'FLOW_FINAL'
  | 'ACTIVITY_FINAL';

export type PolicyStatus = 'DRAFT' | 'ACTIVE' | 'DEPRECATED';

export type InstanceStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';

export type SystemRole = 'ADMIN_DESIGNER' | 'EMPLOYEE' | 'CLIENT';
