import { banksProductsConfig, banksProductsRepository } from '../banks-products/banks-products'
import { policiesRulesConfig, policiesRulesRepository } from '../policies-rules/policies-rules'
import { workflowsConfig, workflowsRepository } from '../workflows/workflows'
import { securityConfig, securityRepository } from '../security/security'
import { systemSettingsConfig, systemSettingsRepository } from '../system-settings/system-settings'
import { managedRouteFromPath } from './managed-routes'

export const managedModules = [
  { config: banksProductsConfig, repository: banksProductsRepository },
  { config: policiesRulesConfig, repository: policiesRulesRepository },
  { config: workflowsConfig, repository: workflowsRepository },
  { config: securityConfig, repository: securityRepository },
  { config: systemSettingsConfig, repository: systemSettingsRepository },
]
export function managedModuleForPath(path: string) {
  for (const module of managedModules) {
    const route = managedRouteFromPath(module.config, path)
    if (route) return { ...module, route }
  }
  return undefined
}
