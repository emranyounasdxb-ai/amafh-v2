import { createManagedRepository } from '../managed/managed-repository'
import { seedRecord, type ManagedConfig } from '../managed/managed-model'

export const policiesRulesConfig: ManagedConfig = {
  slug: 'policies-rules', label: 'Policies & Rules', description: 'Local policy and rule definitions only; no evaluation or enforcement.',
  kinds: [{ id: 'policies', label: 'Policies', singular: 'Policy' }, { id: 'rules', label: 'Rules', singular: 'Rule', parentKind: 'policies' }],
  seed: [seedRecord('sample-policy-1', 'policies', 'Sample Policy'), seedRecord('sample-rule-1', 'rules', 'Sample Rule', 'sample-policy-1')],
}
export const policiesRulesRepository = createManagedRepository(policiesRulesConfig)
