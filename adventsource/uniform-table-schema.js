(function (root) {
  'use strict';

  const uniforms = new Set([
    'Uniform-Woman.svg', 'Uniform-Girl.svg', 'Uniform-Man.svg', 'Uniform-Boy.svg'
  ]);
  const parts = new Set([
    'beret', 'beret-badge', 'right-shoulder-patch', 'left-shoulder-patch',
    'shoulder-cord', 'yellow-scarf', 'black-scarf-slide', 'black-tie',
    'black-bow-tie', 'sash', 'left-pocket-pins', 'right-pocket-name-tag',
    'shirt', 'jumper', 'belt', 'leather-belt', 'belt-buckle', 'pants', 'skirt',
    'adventurer-investiture', 'pathfinder-investiture', 'tlt', 'master-guide', 'shoes'
  ]);

  function stackedTableCount(program, uniform, part) {
    if (part === 'shirt') {
      if (program === 'pathfinder') return uniform === 'Uniform-Girl.svg' ? 4 : 2;
      return ['Uniform-Woman.svg', 'Uniform-Man.svg'].includes(uniform) ? 4 : 2;
    }
    if (program === 'pathfinder' && part === 'pants') {
      if (uniform === 'Uniform-Girl.svg') return 4;
      if (['Uniform-Woman.svg', 'Uniform-Boy.svg'].includes(uniform)) return 2;
    }
    return 1;
  }

  function validateBackup(data) {
    if (!data || data.version !== 1 || !data.tables ||
        typeof data.tables !== 'object' || Array.isArray(data.tables)) {
      throw new Error('Unsupported or invalid backup format.');
    }
    const validated = {};
    for (const [key, table] of Object.entries(data.tables)) {
      let identity;
      try {
        identity = JSON.parse(key);
      } catch {
        throw new Error('A table has an invalid identity.');
      }
      if (Array.isArray(identity) &&
          ['adventurer-t-shirts', 'pathfinder-t-shirts'].includes(identity[2])) continue;
      const isExtraStackedTable = Array.isArray(identity) && identity.length === 4 &&
        Number.isInteger(identity[3]) && identity[3] >= 1 &&
        identity[3] < stackedTableCount(identity[0], identity[1], identity[2]);
      if (!Array.isArray(identity) || (identity.length !== 3 && !isExtraStackedTable) ||
          !['pathfinder', 'adventurer'].includes(identity[0]) ||
          !uniforms.has(identity[1]) || !parts.has(identity[2])) {
        throw new Error('A table has an unknown program, uniform, or item.');
      }
      if (!table || !Array.isArray(table.columns) ||
          ![3, 4, 5, 6].includes(table.columns.length) ||
          !table.columns.every(column => typeof column === 'string') ||
          !Array.isArray(table.rows) ||
          !table.rows.every(row => Array.isArray(row) &&
            row.length === table.columns.length &&
            row.every(cell => typeof cell === 'string'))) {
        throw new Error('A table has invalid columns or rows.');
      }
      validated[key] = {
        columns: [...table.columns],
        rows: table.rows.map(row => [...row])
      };
    }
    return validated;
  }

  const schema = { validateBackup };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = schema;
  } else {
    root.UniformTableSchema = schema;
  }
})(globalThis);
