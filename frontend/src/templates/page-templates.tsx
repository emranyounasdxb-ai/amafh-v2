import type { ReactNode } from 'react'
import { Workspace } from './workspace'
import type { WorkspaceProps } from './workspace'
import { Dialog } from '../components/overlays/dialog'
import { DashboardGrid } from './workspace'
import { ProfileHeader } from '../patterns/shared-patterns'
import type { ProfileHeaderProps } from '../patterns/shared-patterns'

type Base = Pick<WorkspaceProps, 'title' | 'description' | 'breadcrumb' | 'actions' | 'footer'>
export interface ListWorkspaceProps extends Base { toolbar?: ReactNode; list: ReactNode; supporting?: ReactNode }
export function ListWorkspace({ list, ...props }: ListWorkspaceProps) { return <Workspace {...props}>{list}</Workspace> }

export interface ListDetailWorkspaceProps extends ListWorkspaceProps { detailOpen: boolean; detailTitle: string; detail: ReactNode; onDetailClose: () => void }
export function ListDetailWorkspace({ detailOpen, detailTitle, detail, onDetailClose, ...props }: ListDetailWorkspaceProps) { return <><ListWorkspace {...props} /><Dialog mode="drawer" open={detailOpen} onClose={onDetailClose} title={detailTitle}>{detail}</Dialog></> }

export interface ListCreateEditWorkspaceProps extends ListWorkspaceProps { editorOpen: boolean; editorTitle: string; editor: ReactNode; editorActions?: ReactNode; onEditorClose: () => void }
export function ListCreateEditWorkspace({ editorOpen, editorTitle, editor, editorActions, onEditorClose, ...props }: ListCreateEditWorkspaceProps) { return <><ListWorkspace {...props} /><Dialog mode="drawer" open={editorOpen} onClose={onEditorClose} title={editorTitle} actions={editorActions}>{editor}</Dialog></> }

export interface DetailWorkspaceProps extends Base { summary: ReactNode; sections: ReactNode; activity?: ReactNode }
export function DetailWorkspace({ summary, sections, activity, ...props }: DetailWorkspaceProps) { return <Workspace {...props} supporting={activity}><div className="amafh-template-stack">{summary}{sections}</div></Workspace> }

export interface ProfileWorkspaceProps extends Base { profile: ProfileHeaderProps; tabs?: ReactNode; sections: ReactNode }
export function ProfileWorkspace({ profile, tabs, sections, ...props }: ProfileWorkspaceProps) { return <Workspace {...props}><div className="amafh-template-stack"><ProfileHeader {...profile} />{tabs}{sections}</div></Workspace> }

export interface ConfigurationWorkspaceProps extends Base { navigation: ReactNode; sections: ReactNode }
export function ConfigurationWorkspace({ navigation, sections, ...props }: ConfigurationWorkspaceProps) { return <Workspace {...props} supporting={navigation}>{sections}</Workspace> }

export interface WorkflowWorkspaceProps extends Base { queue: ReactNode; detail: ReactNode; timeline?: ReactNode }
export function WorkflowWorkspace({ queue, detail, timeline, ...props }: WorkflowWorkspaceProps) { return <Workspace {...props} supporting={queue}><div className="amafh-template-stack">{detail}{timeline}</div></Workspace> }

export interface ApprovalWorkspaceProps extends Base { queue: ReactNode; request: ReactNode; decision: ReactNode }
export function ApprovalWorkspace({ queue, request, decision, ...props }: ApprovalWorkspaceProps) { return <Workspace {...props} supporting={queue}><div className="amafh-template-stack">{request}{decision}</div></Workspace> }

export interface AnalyticsWorkspaceProps extends Base { filters?: ReactNode; metrics?: ReactNode; charts: ReactNode; details?: ReactNode }
export function AnalyticsWorkspace({ filters, metrics, charts, details, ...props }: AnalyticsWorkspaceProps) { return <Workspace {...props} toolbar={filters}><div className="amafh-template-stack">{metrics && <DashboardGrid>{metrics}</DashboardGrid>}{charts}{details}</div></Workspace> }

export interface SearchWorkspaceProps extends Base { search: ReactNode; filters?: ReactNode; results: ReactNode }
export function SearchWorkspace({ search, filters, results, ...props }: SearchWorkspaceProps) { return <Workspace {...props} toolbar={<>{search}{filters}</>}>{results}</Workspace> }
