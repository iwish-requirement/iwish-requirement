import { supabaseAdmin } from "./supabaseAdmin";
import {
  findInvalidPositiveIntegerDemandFields,
  findMissingRequiredDemandFields,
  type DemandRequiredField,
} from "./demandRequiredFieldUtils";

type ValidateRequiredDemandFieldsInput = {
  departmentId: number;
  demandTypeId?: number | null;
  templateId?: number | null;
  customFields: Record<string, unknown>;
};

async function loadTemplateId(
  departmentId: number,
  demandTypeId?: number | null,
  templateId?: number | null,
) {
  if (templateId) {
    return templateId;
  }

  if (demandTypeId) {
    const { data: demandType, error } = await supabaseAdmin
      .from("demand_types")
      .select("department_id, field_template_id")
      .eq("id", demandTypeId)
      .maybeSingle();

    if (error) {
      throw new Error(`failed to load demand type template: ${error.message}`);
    }

    if (!demandType || (demandType as any).department_id !== departmentId) {
      throw new Error("demand type not found for department");
    }

    if ((demandType as any).field_template_id) {
      return (demandType as any).field_template_id as number;
    }
  }

  const { data: template, error } = await supabaseAdmin
    .from("department_field_templates")
    .select("id")
    .eq("department_id", departmentId)
    .eq("is_active", true)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`failed to load active field template: ${error.message}`);
  }

  return template ? ((template as any).id as number) : null;
}

export async function validateRequiredDemandFields({
  departmentId,
  demandTypeId,
  templateId,
  customFields,
}: ValidateRequiredDemandFieldsInput): Promise<
  | { valid: true }
  | { valid: false; missing: string[]; invalidPositiveIntegers: string[] }
> {
  const resolvedTemplateId = await loadTemplateId(departmentId, demandTypeId, templateId);
  if (!resolvedTemplateId) {
    return { valid: true };
  }

  const { data, error } = await supabaseAdmin
    .from("department_fields")
    .select("key, label, type, required")
    .eq("department_id", departmentId)
    .eq("template_id", resolvedTemplateId)
    .order("order_index", { ascending: true });

  if (error) {
    throw new Error(`failed to load required demand fields: ${error.message}`);
  }

  const requiredFields: DemandRequiredField[] = (data || []).map((field: any) => ({
    key: field.key as string | null,
    label: field.label as string | null,
    type: field.type as string | null,
    required: !!field.required,
  }));
  const missing = findMissingRequiredDemandFields(requiredFields, customFields);
  const invalidPositiveIntegers = findInvalidPositiveIntegerDemandFields(requiredFields, customFields);

  return missing.length > 0 || invalidPositiveIntegers.length > 0
    ? { valid: false, missing, invalidPositiveIntegers }
    : { valid: true };
}
