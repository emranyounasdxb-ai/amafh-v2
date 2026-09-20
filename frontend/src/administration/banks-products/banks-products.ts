import { createManagedRepository, managedStorageKey } from '../managed/managed-repository'
import { seedRecord, type ManagedConfig } from '../managed/managed-model'

export const banksProductsConfig: ManagedConfig = {
  slug: 'banks-products', label: 'Banks & Products', description: 'Local bank and product catalogue. No external integration.',
  kinds: [{ id: 'banks', label: 'Banks', singular: 'Bank' }, { id: 'products', label: 'Products', singular: 'Product', parentKind: 'banks' }, { id: 'variants', label: 'Product Variants', singular: 'Product Variant', parentKind: 'products' }],
  seed: [seedRecord('sample-bank-1', 'banks', 'Sample Bank'), seedRecord('sample-product-1', 'products', 'Sample Product', 'sample-bank-1'), seedRecord('sample-variant-1', 'variants', 'Sample Variant', 'sample-product-1'), seedRecord('sample-variant-2', 'variants', 'Another Variant', 'sample-product-1'), seedRecord('sample-variant-3', 'variants', 'Business Variant', 'sample-product-1')],
}
const baseRepository = createManagedRepository(banksProductsConfig)
const upgradeKey = 'amafh-v2.mock-banks-products.variants-ready'
async function upgradeVariants() {
  const raw = localStorage.getItem(managedStorageKey('banks-products'))
  if (raw === null || localStorage.getItem(upgradeKey)) return
  const records = await baseRepository.list()
  if (records.some(item => item.id === 'sample-product-1') && !records.some(item => item.kind === 'variants')) {
    const additions = banksProductsConfig.seed.filter(item => item.kind === 'variants')
    localStorage.setItem(managedStorageKey('banks-products'), JSON.stringify({ version: 1, records: [...records, ...additions] }))
  }
  localStorage.setItem(upgradeKey, '1')
}
export const banksProductsRepository = {
  async list() { await upgradeVariants(); return baseRepository.list() },
  async create(...args: Parameters<typeof baseRepository.create>) { await upgradeVariants(); return baseRepository.create(...args) },
  async update(...args: Parameters<typeof baseRepository.update>) { await upgradeVariants(); return baseRepository.update(...args) },
  async remove(id: string) {
    await upgradeVariants()
    const records = await baseRepository.list(); const target = records.find(item => item.id === id)
    if (target?.kind === 'products') {
      const { productStagesRepository } = await import('./product-stages')
      const stages = await productStagesRepository.list(id)
      if (stages.length) throw new Error(`Cannot delete ${target.name}: ${stages.length} Product Stages depend on it.`)
    }
    if (target && !records.some(item => item.parentId === id)) {
      const { caseRepository } = await import('../../cases/case-repository')
      const cases = await caseRepository.list()
      const linked = cases.filter(item => target.kind === 'banks' ? item.bank === target.name : target.kind === 'products' ? item.bank === records.find(bank => bank.id === target.parentId)?.name && item.product === target.name : item.bank === records.find(bank => bank.id === records.find(product => product.id === target.parentId)?.parentId)?.name && item.product === records.find(product => product.id === target.parentId)?.name && item.productVariant === target.name)
      if (linked.length) throw new Error(`Cannot delete ${target.name}: ${linked.length} related ${linked.length === 1 ? 'Case depends' : 'Cases depend'} on it.`)
    }
    return baseRepository.remove(id)
  },
}
