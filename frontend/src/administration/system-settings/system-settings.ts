import { createManagedRepository } from '../managed/managed-repository'
import { seedRecord, type ManagedConfig } from '../managed/managed-model'

export const systemSettingsConfig: ManagedConfig = {
  slug: 'system-settings', label: 'System Settings', description: 'Local settings catalogue. Values are illustrative and do not change application behavior.',
  kinds: [{ id: 'settings', label: 'Settings', singular: 'Setting', extraLabel: 'Value' }],
  seed: [seedRecord('sample-setting-1', 'settings', 'Sample Setting', '', 'Sample value')],
}
export const systemSettingsRepository = createManagedRepository(systemSettingsConfig)
