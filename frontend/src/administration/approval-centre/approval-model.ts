export type ApprovalStatus = 'pending' | 'approved' | 'rejected'
export interface ApprovalDraft { title: string; description: string }
export interface ApprovalRecord extends ApprovalDraft { id: string; status: ApprovalStatus; createdAt: string; updatedAt: string }
export type ApprovalErrors = Partial<Record<keyof ApprovalDraft, string>>
export function validateApprovalDraft(draft: ApprovalDraft, records: ApprovalRecord[], editingId?: string): ApprovalErrors {
  const errors: ApprovalErrors = {}
  const title = draft.title.trim().replace(/\s+/g, ' ')
  if (!title) errors.title = 'Title is required.'
  else if (title.length > 120) errors.title = 'Use 120 characters or fewer.'
  else if (records.some(item => item.id !== editingId && item.title.trim().replace(/\s+/g, ' ').toLocaleLowerCase() === title.toLocaleLowerCase())) errors.title = 'An approval request with this title already exists.'
  if (!draft.description.trim()) errors.description = 'Description is required.'
  else if (draft.description.trim().length > 500) errors.description = 'Use 500 characters or fewer.'
  return errors
}
