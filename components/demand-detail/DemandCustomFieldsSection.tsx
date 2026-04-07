"use client";

import React, { type Dispatch, type SetStateAction } from "react";
import { Grid } from "lucide-react";
import { type FieldDefinition } from "../../types";

interface DemandCustomFieldsSectionProps {
  templateFields: FieldDefinition[];
  isEditing: boolean;
  demandCustomFields?: Record<string, any> | null;
  draftCustomFields: Record<string, any>;
  setDraftCustomFields: Dispatch<SetStateAction<Record<string, any>>>;
}

interface FieldRendererProps {
  field: FieldDefinition;
  rawValue: unknown;
  isEditing: boolean;
  setDraftCustomFields: Dispatch<SetStateAction<Record<string, any>>>;
}

const FieldRenderer = React.memo(function FieldRenderer({
  field,
  rawValue,
  isEditing,
  setDraftCustomFields,
}: FieldRendererProps) {
  if (!isEditing && (rawValue === undefined || rawValue === null || rawValue === "")) {
    return null;
  }

  const value = rawValue ?? "";
  const multiValues = Array.isArray(rawValue)
    ? (rawValue as string[])
    : rawValue
      ? [String(rawValue)]
      : [];
  const booleanValue =
    typeof rawValue === "boolean" ? rawValue : rawValue === "true" || rawValue === "1";
  const displayValue =
    field.type === "multi_select"
      ? multiValues.join("、")
      : field.type === "boolean"
        ? booleanValue
          ? "是"
          : "否"
        : (value as string);

  const updateFieldValue = (nextValue: unknown) => {
    setDraftCustomFields((prev) => ({
      ...prev,
      [field.id]: nextValue,
    }));
  };

  return (
    <div className={field.type === "multiline" ? "sm:col-span-2" : ""}>
      <div className="text-xs font-bold text-slate-400 uppercase mb-1">{field.label}</div>
      {isEditing ? (
        <>
          {field.type === "text" && (
            <input
              type="text"
              value={value as string}
              onChange={(e) => updateFieldValue(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          )}
          {field.type === "number" && (
            <input
              type="number"
              value={value as string}
              onChange={(e) => updateFieldValue(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          )}
          {field.type === "date" && (
            <input
              type="date"
              value={value as string}
              onChange={(e) => updateFieldValue(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          )}
          {field.type === "select" && (
            <select
              value={value as string}
              onChange={(e) => updateFieldValue(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
            >
              <option value="">请选择</option>
              {field.options?.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          )}
          {field.type === "multi_select" && (
            <div className="flex flex-wrap gap-2">
              {field.options?.map((option) => {
                const checked = multiValues.includes(option);
                return (
                  <label
                    key={option}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs cursor-pointer select-none border-slate-200 hover:border-blue-400 hover:bg-blue-50"
                  >
                    <input
                      type="checkbox"
                      className="w-4 h-4 text-blue-600 rounded border-slate-300"
                      checked={checked}
                      onChange={(e) => {
                        const nextValues = e.target.checked
                          ? Array.from(new Set([...multiValues, option]))
                          : multiValues.filter((item) => item !== option);
                        updateFieldValue(nextValues);
                      }}
                    />
                    <span className="text-slate-700">{option}</span>
                  </label>
                );
              })}
            </div>
          )}
          {field.type === "multiline" && (
            <textarea
              rows={3}
              value={value as string}
              onChange={(e) => updateFieldValue(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
            />
          )}
          {field.type === "boolean" && (
            <label className="inline-flex items-center gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={booleanValue}
                onChange={(e) => updateFieldValue(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-slate-300"
              />
              <span>是 / 否</span>
            </label>
          )}
          {field.type === "url" && (
            <input
              type="url"
              value={value as string}
              onChange={(e) => updateFieldValue(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              placeholder="https://example.com"
            />
          )}
          {field.type === "email" && (
            <input
              type="email"
              value={value as string}
              onChange={(e) => updateFieldValue(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              placeholder="name@example.com"
            />
          )}
          {field.type === "phone" && (
            <input
              type="tel"
              value={value as string}
              onChange={(e) => updateFieldValue(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              placeholder="请输入手机号"
            />
          )}
        </>
      ) : field.type === "url" && typeof value === "string" && value ? (
        <a
          href={value as string}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline break-all text-sm md:text-base"
        >
          {value as string}
        </a>
      ) : (
        <div className="text-slate-800 font-medium text-sm md:text-base break-words">
          {displayValue}
        </div>
      )}
    </div>
  );
});

const DemandCustomFieldsSection = React.memo(function DemandCustomFieldsSection({
  templateFields,
  isEditing,
  demandCustomFields,
  draftCustomFields,
  setDraftCustomFields,
}: DemandCustomFieldsSectionProps) {
  if (templateFields.length === 0) {
    return null;
  }

  return (
    <div className="bg-slate-50 rounded-xl p-6 mb-8 border border-slate-100">
      <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
        <Grid className="w-4 h-4 text-slate-400" /> 业务专属信息
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8">
        {templateFields.map((field) => {
          const rawValue = isEditing
            ? draftCustomFields[field.id]
            : demandCustomFields
              ? demandCustomFields[field.id]
              : undefined;

          return (
            <FieldRenderer
              key={field.id}
              field={field}
              rawValue={rawValue}
              isEditing={isEditing}
              setDraftCustomFields={setDraftCustomFields}
            />
          );
        })}
      </div>
    </div>
  );
});

export default DemandCustomFieldsSection;
