import type { Department, FieldDefinition } from '../types';

const DEFAULT_DEPARTMENTS: Department[] = [];
const DEFAULT_FIELD_TEMPLATES: Record<string, FieldDefinition[]> = {};

const KEYS = {
  DEPTS: 'nexus_departments',
  TEMPLATES: 'nexus_field_templates'
};

export const getDepartments = (): Department[] => {
  const stored = localStorage.getItem(KEYS.DEPTS);
  return stored ? (JSON.parse(stored) as Department[]) : DEFAULT_DEPARTMENTS;
};

export const saveDepartments = (depts: Department[]) => {
  localStorage.setItem(KEYS.DEPTS, JSON.stringify(depts));
  window.dispatchEvent(new Event('storage_update'));
};

export const getFieldTemplates = (): Record<string, FieldDefinition[]> => {
  const stored = localStorage.getItem(KEYS.TEMPLATES);
  return stored
    ? (JSON.parse(stored) as Record<string, FieldDefinition[]>)
    : DEFAULT_FIELD_TEMPLATES;
};

export const saveFieldTemplates = (templates: Record<string, FieldDefinition[]>) => {
  localStorage.setItem(KEYS.TEMPLATES, JSON.stringify(templates));
  window.dispatchEvent(new Event('storage_update'));
};

export const getFieldsForDepartment = (deptId: string): FieldDefinition[] => {
  const templates = getFieldTemplates();
  return templates[deptId] || [];
};
