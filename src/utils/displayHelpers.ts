import { departmentPositionService } from '@/services/departmentPosition'

// 缓存部门和岗位数据
let departmentsCache: Array<{ code: string; name: string }> = []
let positionsCache: Array<{ code: string; name: string }> = []
let cacheExpiry = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5分钟缓存

// 初始化缓存
async function initializeCache() {
  const now = Date.now()
  if (now < cacheExpiry && departmentsCache.length > 0) {
    return // 缓存仍然有效
  }

  try {
    const [departments, positions] = await Promise.all([
      departmentPositionService.getDepartments(true),
      departmentPositionService.getPositions(undefined, true)
    ])

    departmentsCache = departments.map(d => ({ code: d.code, name: d.name }))
    positionsCache = positions.map(p => ({ code: p.code, name: p.name }))
    cacheExpiry = now + CACHE_DURATION
  } catch (error) {
    console.error('初始化部门岗位缓存失败:', error)
  }
}

/**
 * 将部门代码转换为中文名称
 * @param departmentCode 部门代码
 * @returns 部门中文名称，如果找不到则返回原代码
 */
export async function getDepartmentDisplayName(departmentCode: string): Promise<string> {
  if (!departmentCode) return ''
  
  await initializeCache()
  
  const department = departmentsCache.find(d => d.code === departmentCode)
  return department?.name || departmentCode
}

/**
 * 将岗位代码转换为中文名称
 * @param positionCode 岗位代码
 * @returns 岗位中文名称，如果找不到则返回原代码
 */
export async function getPositionDisplayName(positionCode: string): Promise<string> {
  if (!positionCode) return ''
  
  await initializeCache()
  
  const position = positionsCache.find(p => p.code === positionCode)
  return position?.name || positionCode
}

/**
 * 批量转换部门代码为中文名称
 * @param departmentCodes 部门代码数组
 * @returns 部门中文名称数组
 */
export async function getDepartmentDisplayNames(departmentCodes: string[]): Promise<string[]> {
  if (!departmentCodes.length) return []
  
  await initializeCache()
  
  return departmentCodes.map(code => {
    const department = departmentsCache.find(d => d.code === code)
    return department?.name || code
  })
}

/**
 * 批量转换岗位代码为中文名称
 * @param positionCodes 岗位代码数组
 * @returns 岗位中文名称数组
 */
export async function getPositionDisplayNames(positionCodes: string[]): Promise<string[]> {
  if (!positionCodes.length) return []
  
  await initializeCache()
  
  return positionCodes.map(code => {
    const position = positionsCache.find(p => p.code === code)
    return position?.name || code
  })
}

/**
 * 获取所有部门选项（用于下拉框）
 * @returns 部门选项数组
 */
export async function getDepartmentOptions(): Promise<Array<{ value: string; label: string }>> {
  await initializeCache()
  return departmentsCache.map(d => ({ value: d.code, label: d.name }))
}

/**
 * 获取所有岗位选项（用于下拉框）
 * @param departmentCode 可选的部门代码，用于过滤岗位
 * @returns 岗位选项数组
 */
export async function getPositionOptions(departmentCode?: string): Promise<Array<{ value: string; label: string }>> {
  await initializeCache()
  
  let filteredPositions = positionsCache
  
  if (departmentCode) {
    // 如果指定了部门，需要从服务获取该部门的岗位
    try {
      const positions = await departmentPositionService.getPositions(departmentCode, true)
      filteredPositions = positions.map(p => ({ code: p.code, name: p.name }))
    } catch (error) {
      console.error('获取部门岗位失败:', error)
    }
  }
  
  return filteredPositions.map(p => ({ value: p.code, label: p.name }))
}

/**
 * 清除缓存（用于数据更新后刷新）
 */
export function clearDisplayCache() {
  departmentsCache = []
  positionsCache = []
  cacheExpiry = 0
}

/**
 * 智能显示部门名称（如果是代码则转换，如果已经是中文名称则直接返回）
 * @param departmentValue 部门值（可能是代码或中文名称）
 * @returns 部门中文名称
 */
export async function getSmartDepartmentDisplayName(departmentValue: string): Promise<string> {
  if (!departmentValue) return ''
  
  await initializeCache()
  
  // 先检查是否已经是中文名称
  const existingByName = departmentsCache.find(d => d.name === departmentValue)
  if (existingByName) return departmentValue
  
  // 再检查是否是代码
  const existingByCode = departmentsCache.find(d => d.code === departmentValue)
  return existingByCode?.name || departmentValue
}

/**
 * 智能显示岗位名称（如果是代码则转换，如果已经是中文名称则直接返回）
 * @param positionValue 岗位值（可能是代码或中文名称）
 * @returns 岗位中文名称
 */
export async function getSmartPositionDisplayName(positionValue: string): Promise<string> {
  if (!positionValue) return ''
  
  await initializeCache()
  
  // 先检查是否已经是中文名称
  const existingByName = positionsCache.find(p => p.name === positionValue)
  if (existingByName) return positionValue
  
  // 再检查是否是代码
  const existingByCode = positionsCache.find(p => p.code === positionValue)
  return existingByCode?.name || positionValue
}