import { createManagedRepository } from '../managed/managed-repository'
import { seedRecord, type ManagedConfig } from '../managed/managed-model'

export const securityConfig: ManagedConfig = {
  slug: 'security', label: 'Security', description: 'Local security configuration catalogue. These controls do not enforce authentication or access.',
  kinds: [{ id: 'controls', label: 'Controls', singular: 'Security control' }],
  seed: [seedRecord('sample-control-1', 'controls', 'Sample Control')],
}
export const securityRepository = createManagedRepository(securityConfig)
