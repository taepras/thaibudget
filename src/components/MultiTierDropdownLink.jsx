import React from 'react';
import DropdownLink from './DropdownLink';

/**
 * A cascading two-tier dropdown for hierarchical dimensions (e.g. budgetary_unit, category).
 *
 * Props:
 *   label   – dimension display name (e.g. "หน่วยรับงบฯ")
 *   options – [{id, name, children?: [{id, name}]}]  (raw API shape)
 *   value   – null | "tier1Id" | "tier1Id,tier2Id"   (comma-separated path string)
 *   onChange – (newValue: null | string) => void
 *
 * When the user resets to "ทั้งหมด" (null) the parent should delete the filter key so
 * navigation-derived filtering resumes.
 */
function MultiTierDropdownLink({ label, options, value, onChange }) {
  const pathParts = value != null
    ? String(value).split(',').map(Number).filter((n) => !Number.isNaN(n))
    : [];

  let tier1Id = pathParts.length >= 1 ? pathParts[0] : null;
  let tier2Id = pathParts.length >= 2 ? pathParts[1] : null;

  // Handle navigation-derived bare child ID (e.g. value="63" is a level-2 unit, not level-1)
  if (tier1Id !== null && tier2Id === null) {
    const parent = options.find((o) => o.children?.some((c) => Number(c.id) === tier1Id));
    if (parent) {
      tier2Id = tier1Id;
      tier1Id = Number(parent.id);
    }
  }

  const selectedTier1 = options.find((o) => Number(o.id) === tier1Id) ?? null;

  const tier1Options = [
    { value: null, label: 'ทั้งหมด' },
    ...options.map((o) => ({ value: Number(o.id), label: o.name })),
  ];

  const tier2Options = selectedTier1?.children?.length > 0
    ? [
        { value: null, label: 'ทั้งหมด' },
        ...selectedTier1.children.map((c) => ({ value: Number(c.id), label: c.name })),
      ]
    : null;

  const tier1Label = selectedTier1 ? selectedTier1.name : 'ทั้งหมด';
  const tier2Label = tier2Id !== null
    ? (tier2Options?.find((o) => o.value === tier2Id)?.label ?? String(tier2Id))
    : 'ทั้งหมด';

  const handleTier1Change = (newId) => {
    onChange(newId !== null ? String(newId) : null);
  };

  const handleTier2Change = (newId) => {
    // Keep tier-1 selected; null tier-2 means "all within this tier-1"
    onChange(newId !== null ? `${tier1Id},${newId}` : String(tier1Id));
  };

  return (
    <div>
      <DropdownLink
        label={`${label}: ${tier1Label}`}
        options={tier1Options}
        value={tier1Id}
        onChange={handleTier1Change}
        isActive={tier1Id !== null}
      />
      {tier1Id !== null && tier2Options && (
        <div style={{ marginLeft: 4, marginTop: 4 }}>
          ↳ {' '}
          <DropdownLink
            label={tier2Label}
            options={tier2Options}
            value={tier2Id}
            onChange={handleTier2Change}
            isActive={tier2Id !== null}
          />
        </div>
      )}
    </div>
  );
}

export default MultiTierDropdownLink;
