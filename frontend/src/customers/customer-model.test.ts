import { beforeEach, expect, test } from 'vitest'
import { emptyCompany, emptyIndividual, findCustomerMatches, validateCustomerDraft, type ApplicationDraft } from './customer-model'
import { CUSTOMER_STORAGE_KEY, mockApplicationRepository, mockCustomerRepository } from './mock-customer-repository'
import { PERMISSIONS_STORAGE_KEY } from '../administration/permissions/mock-permissions-repository'

const application: ApplicationDraft = { bank: 'Sample Bank', product: 'Sample Product', productVariant: 'Sample Variant', requestedAmount: '10000', caseOwnerId: 'sample-aisha' }
beforeEach(() => { localStorage.clear(); localStorage.setItem(PERMISSIONS_STORAGE_KEY, JSON.stringify({ version: 1, permissions: [...['edit', 'delete'].map(action => ({ id: `customers-${action}`, domain: 'Customers', action, description: 'Test action', enabled: true, userTypeIds: ['sample-type-1'], createdAt: '2026-09-20T00:00:00Z', updatedAt: '2026-09-20T00:00:00Z' })), { id: 'cases-create', domain: 'Cases', action: 'create', description: 'Test action', enabled: true, userTypeIds: ['sample-type-1'], createdAt: '2026-09-20T00:00:00Z', updatedAt: '2026-09-20T00:00:00Z' }] })) })

test('individual identifiers are unique; own identifiers, duplicate names and mobiles remain valid', async () => {
  const customers = await mockCustomerRepository.list()
  const first = customers.find(item => item.id === 'sample-individual-1')!
  const second = customers.find(item => item.id === 'sample-individual-2')!
  if (first.type !== 'individual' || second.type !== 'individual') throw new Error('Invalid sample')
  const own = { ...first, fullName: second.type === 'individual' ? second.fullName : '', mobile: second.mobile }
  expect(validateCustomerDraft(own, customers, first.id)).toEqual({})
  expect(validateCustomerDraft({ ...own, emiratesId: second.emiratesId }, customers, first.id).emiratesId).toMatch(/already assigned/)
  expect(validateCustomerDraft({ ...own, passportNumber: second.passportNumber }, customers, first.id).passportNumber).toMatch(/already assigned/)
  expect(findCustomerMatches({ ...emptyIndividual(), emiratesId: first.type === 'individual' ? first.emiratesId.replaceAll('-', '') : '' }, customers).map(item => item.id)).toContain(first.id)
  expect(findCustomerMatches({ ...emptyIndividual(), passportNumber: first.type === 'individual' ? first.passportNumber.toLowerCase() : '' }, customers).map(item => item.id)).toContain(first.id)
})

test('new Individual and Company customers are created only with linked Applications', async () => {
  const initial = await mockCustomerRepository.list()
  const individual = { ...emptyIndividual(), fullName: 'Aisha Rahman', emiratesId: '784-2001-0000000-9', passportNumber: 'P1000009', mobile: initial[0].mobile }
  const result = await mockApplicationRepository.createWithCustomer(application, { mode: 'new', draft: individual }, 'sample-aisha')
  expect(result.application.customerId).toBe(result.customer.id)
  expect((await mockCustomerRepository.list()).length).toBe(initial.length + 1)
  await expect(mockApplicationRepository.createWithCustomer(application, { mode: 'new', draft: { ...individual, fullName: 'Another Name' } }, 'sample-aisha')).rejects.toThrow(/Emirates ID/)
  await expect(mockApplicationRepository.createWithCustomer(application, { mode: 'new', draft: { ...individual, emiratesId: '', passportNumber: 'P1000009' } }, 'sample-aisha')).rejects.toThrow(/Passport Number/)
  const company = { ...emptyCompany(), companyName: 'New Example LLC', tradeLicense: 'TL-90001', contactPerson: 'Contact', mobile: initial[0].mobile }
  const companyResult = await mockApplicationRepository.createWithCustomer(application, { mode: 'new', draft: company }, 'sample-aisha')
  expect(companyResult.customer.type).toBe('company')
  expect(companyResult.application.customerId).toBe(companyResult.customer.id)
  await expect(mockApplicationRepository.createWithCustomer(application, { mode: 'new', draft: { ...company, companyName: 'Another Business' } }, 'sample-aisha')).rejects.toThrow('A matching customer already exists')
  expect((await mockApplicationRepository.list()).filter(item => item.customerId === result.customer.id)).toHaveLength(1)
})

test('existing customer attachment is one-to-many, edit persists, and deletion protects relationships', async () => {
  const first = (await mockCustomerRepository.list())[0]
  const before = (await mockApplicationRepository.list()).filter(item => item.customerId === first.id).length
  await mockApplicationRepository.createWithCustomer(application, { mode: 'existing', id: first.id }, 'sample-aisha')
  expect((await mockApplicationRepository.list()).filter(item => item.customerId === first.id)).toHaveLength(before + 1)
  const updated = await mockCustomerRepository.update(first.id, first, 'inactive', 'sample-aisha')
  expect(updated.status).toBe('inactive')
  expect(updated.history.at(-1)?.label).toBe('Status changed to inactive')
  await expect(mockCustomerRepository.remove(first.id, 'sample-aisha')).rejects.toThrow(/related Applications\/Cases depend/)
  expect((await mockCustomerRepository.list()).some(item => item.id === first.id)).toBe(true)
  const noApps = (await mockCustomerRepository.list()).find(item => item.id === 'sample-individual-2')!
  await mockCustomerRepository.remove(noApps.id, 'sample-aisha')
  expect((await mockCustomerRepository.list()).some(item => item.id === noApps.id)).toBe(false)
})

test('empty and malformed local stores are handled without orphan records', async () => {
  localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify({ version: 1, customers: [], applications: [] }))
  expect(await mockCustomerRepository.list()).toEqual([])
  localStorage.setItem(CUSTOMER_STORAGE_KEY, '{broken')
  await expect(mockCustomerRepository.list()).rejects.toThrow(/could not be read/)
  localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify({ version: 1, customers: [], applications: [{ id: 'orphan', customerId: 'missing', bank: '', product: '', productVariant: '', requestedAmount: '', initialCaseOwner: '', createdAt: '' }] }))
  await expect(mockApplicationRepository.list()).rejects.toThrow(/could not be read/)
})

test('direct Customer mutations reject missing manual permissions', async () => {
  const customer = (await mockCustomerRepository.list()).find(item => item.id === 'sample-individual-2')!
  localStorage.removeItem(PERMISSIONS_STORAGE_KEY)
  await expect(mockCustomerRepository.update(customer.id, customer, 'active', 'sample-aisha')).rejects.toThrow(/Customers: edit/)
  await expect(mockCustomerRepository.remove(customer.id, 'sample-aisha')).rejects.toThrow(/Customers: delete/)
  expect((await mockCustomerRepository.list()).some(item => item.id === customer.id)).toBe(true)
})
