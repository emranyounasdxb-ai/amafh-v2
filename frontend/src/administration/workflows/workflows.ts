import { createManagedRepository } from '../managed/managed-repository'
import { seedRecord, type ManagedConfig } from '../managed/managed-model'

export const workflowsConfig: ManagedConfig = {
  slug: 'workflows', label: 'Workflows', description: 'Local workflow definitions only; no execution or routing.',
  kinds: [{ id: 'definitions', label: 'Definitions', singular: 'Workflow', extraLabel: 'Stages' }],
  seed: [seedRecord('sample-workflow-1', 'definitions', 'Sample Workflow', '', 'Draft\nReview')],
}
export const workflowsRepository = createManagedRepository(workflowsConfig)
