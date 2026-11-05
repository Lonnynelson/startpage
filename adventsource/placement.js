(() => {
  'use strict';

  const svgNS = 'http://www.w3.org/2000/svg';
  const assetPath = 'assets/placement/';
  const form = document.getElementById('placement-form');
  const chest = document.getElementById('chest-items');
  const sleeves = document.getElementById('sleeve-items');
  const notes = document.getElementById('placement-notes');
  const levels = [
    { name: 'Friend', advanced: 'Trail Friend', color: '#104f98', text: '#ffdc00' },
    { name: 'Companion', advanced: 'Trail Companion', color: '#ed2024', text: '#ffdc00' },
    { name: 'Explorer', advanced: 'Wilderness Explorer', color: '#008458', text: '#ffdc00' },
    { name: 'Ranger', advanced: 'Wilderness Ranger', color: '#817762', text: '#ffdc00' },
    { name: 'Voyager', advanced: 'Frontier Voyager', color: '#90032a', text: '#fff' },
    { name: 'Guide', advanced: 'Frontier Guide', color: '#ffc34c', text: '#ed2024' }
  ];
  const checked = id => document.getElementById(id).checked;
  const value = id => document.getElementById(id).value;
  let itemCount = 0;
  const failedAssets = new Set();

  function element(tag, attributes = {}, parent, content) {
    const node = document.createElementNS(svgNS, tag);
    for (const [key, val] of Object.entries(attributes)) node.setAttribute(key, String(val));
    if (content !== undefined) node.textContent = content;
    if (parent) parent.append(node);
    return node;
  }

  function text(parent, x, y, content, attributes = {}) {
    return element('text', {
      x, y, 'text-anchor': 'middle', 'font-family': 'system-ui, sans-serif',
      'font-size': 16, fill: '#162b35', ...attributes
    }, parent, content);
  }

  function item(parent, name) {
    itemCount += 1;
    const group = element('g', { 'data-item': name }, parent);
    element('title', {}, group, name);
    return group;
  }

  function image(parent, filename, x, y, width, height, name) {
    const group = item(parent, name);
    const node = element('image', {
      href: assetPath + filename, x, y, width, height, preserveAspectRatio: 'xMidYMid meet'
    }, group);
    node.addEventListener('error', () => {
      failedAssets.add(filename);
      const error = document.getElementById('asset-error');
      error.hidden = false;
      error.textContent = `Unable to load placement artwork: ${Array.from(failedAssets).join(', ')}. Check that the placement assets were deployed with this page.`;
      text(group, x + width / 2, y + height / 2, 'Image unavailable', { 'font-size': 10, fill: '#8a1111' });
    });
  }

  function addNote(content) {
    const li = document.createElement('li');
    li.textContent = content;
    notes.append(li);
  }

  function addOptions() {
    for (const [target, prefix, advanced] of [
      ['level-options', 'level', false], ['ribbon-options', 'ribbon', true]
    ]) {
      levels.forEach(level => {
        const label = document.createElement('label');
        label.className = 'check';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = `${prefix}-${level.name}`;
        input.name = input.id;
        label.append(input, advanced ? level.advanced : level.name);
        document.getElementById(target).append(label);
      });
    }
  }

  function drawBase() {
    const base = document.getElementById('chest-base');
    for (const x of [95, 585]) {
      element('path', { d: `M${x} 220 h320 v255 l-25 25 h-270 l-25 -25 Z`, class: 'pocket' }, base);
      element('path', { d: `M${x + 12} 232 h296 v238 l-20 18 h-256 l-20 -18 Z`, class: 'seam' }, base);
      element('path', { d: `M${x + 140} 350 v145 m40 0 v-145`, class: 'seam' }, base);
      element('path', { d: `M${x} 220 h320 v100 l-25 30 h-270 l-25 -30 Z`, class: 'pocket' }, base);
      element('path', { d: `M${x + 10} 230 h300 v86 l-20 24 h-260 l-20 -24 Z`, class: 'seam' }, base);
      element('circle', { cx: x + 160, cy: 323, r: 12, fill: '#97866b' }, base);
      for (const dx of [-3, 3]) {
        for (const dy of [-3, 3]) element('circle', { cx: x + 160 + dx, cy: 323 + dy, r: 1.5, fill: '#d8c8ad' }, base);
      }
    }
    for (const [letter, x] of [['A', 625], ['B', 680], ['C', 810], ['D', 865]]) {
      text(base, x, 305, letter, { class: 'slot' });
    }
    text(base, 255, 535, 'Name tag above this pocket', { class: 'diagram-note' });
    text(base, 745, 535, 'Pins A / B / C / D on the flap', { class: 'diagram-note' });
    const sleeveBase = document.getElementById('sleeve-base');
    for (const x of [125, 615]) {
      element('path', { d: `M${x} 1230 V700 Q${x} 620 ${x + 130} 620 Q${x + 260} 620 ${x + 260} 700 V1230 Z`, class: 'sleeve' }, sleeveBase);
      element('path', { d: `M${x + 12} 1216 h236 M${x + 130} 625 v590`, class: 'seam' }, sleeveBase);
      text(sleeveBase, x + 130, 612, 'Shoulder seam', { class: 'diagram-note' });
    }
  }

  function constrainSelections() {
    const staff = value('wearer') === 'staff';
    const setCheckboxAvailability = (id, available) => {
      const control = document.getElementById(id);
      control.disabled = !available;
      if (!available) control.checked = false;
    };
    setCheckboxAvailability('good-conduct', !staff);
    const service = document.getElementById('service');
    service.querySelector('[value="tlt-star"]').disabled = staff;
    service.querySelector('[value="staff-star"]').disabled = !staff;
    if (service.selectedOptions[0].disabled) service.value = '';
    const strip = document.getElementById('staff-strip');
    for (const option of strip.options) option.disabled = !staff && option.value !== '' && option.value !== 'TLT';
    if (strip.selectedOptions[0].disabled) strip.value = '';
    setCheckboxAvailability('union', checked('conference'));
  }

  function drawChest(earned, advanced) {
    const master = checked('master-guide');
    if (checked('show-strip') && (earned.length || master)) {
      if (master) {
        image(chest, 'Left_Pocket_Master_Guide_Name_Strip.png', 660, 152, 170, 56, 'Master Guide name strip');
      } else {
        const level = earned[earned.length - 1];
        image(chest, `Left_Pocket_Name_Strip_${level.name}.png`, 660, 155, 170, 53, `${level.name} name strip`);
      }
      addNote('Name strip: highest earned level, centered above the left pocket.');
    }
    if (checked('show-pins')) {
      earned.forEach((level, index) => {
        image(chest, `Left_Pocket_Pin_${level.name}.png`,
          745 - (earned.length * 31 - 7) / 2 + index * 31, 267, 24, 24, `${level.name} level pin`);
      });
      if (earned.length) addNote('Level pins: centered across the upper flap, highest level at the wearer\'s left; skipped levels leave no gaps.');
    }
    if (master) {
      image(chest, 'Left_Pocket_Master_Guide_Pin.png', 732, 233, 26, 26, 'Master Guide pin');
      addNote('Master Guide pin: centered on the flap, above the level pins.');
    }
    // Lowest earned bars form the bottom row; an incomplete top row stays centered.
    advanced.forEach((level, index) => {
      const row = Math.floor(index / 2);
      const rowSize = Math.min(2, advanced.length - row * 2);
      image(chest, `Left_Pocket_Ribbon_Bar_${level.name}.png`,
        745 - rowSize * 38 + (index % 2) * 76, 130 - row * 24, 76, 23, `${level.advanced} ribbon bar`);
    });
    if (advanced.length) addNote('Advanced ribbons: centered above the name strip, lowest levels on the bottom row; no gaps for unearned bars.');
    if (checked('good-conduct')) {
      image(chest, 'Laft_Pocket_Good_Conduct_Ribbon_Bar.png',
        707, 130 - Math.ceil(advanced.length / 2) * 24 - 2, 76, 23, 'Good Conduct Award');
      addNote('Good Conduct: centered above the advanced ribbon bars (Pathfinders only).');
    }
    if (checked('baptismal')) image(chest, 'Left_Pocket_A_Baptismal_Pin.png', 611, 310, 28, 26, 'A: Baptismal pin');
    if (checked('pbe')) image(chest, 'Left_Pocket_B_PBE_Pin.png', 658, 310, 44, 87, 'B: PBE pin with sample hanging bars');
    if (value('tlt')) {
      const masterTLT = value('tlt') === 'master-tlt';
      image(chest, masterTLT ? 'Laft_Pocket_C_TLT_Master_Pin.png' : 'Laft_Pocket_C_TLT_Pin.png',
        796, 307, 28, 33, `C: ${masterTLT ? 'Master TLT' : 'TLT'} pin`);
    }
    if (value('service')) {
      const staff = value('service') === 'staff-star';
      image(chest, staff ? 'Laft_Pocket_C_Staff_Service_Star_Pin.png' : 'Laft_Pocket_C_TLT_Service_Star_Pin.png',
        846, 305, 38, 37, `D: ${staff ? 'Staff service' : 'TLT level'} star (1)`);
      addNote('Service / level star: position D, not C. Only one star is worn; the supplied artwork shows 1.');
    }
    if (value('leadership')) {
      image(chest, `Right_Pocket_${value('leadership')}.png`, 177, 417, 156, 42, `${value('leadership')} unit leadership plate`);
      addNote('Unit leadership plate: centered on the wearer\'s right pocket (left side of this front view).');
    }
    if (checked('nameplate')) {
      const group = item(chest, 'Name tag');
      element('rect', { x: 145, y: 174, width: 220, height: 34, fill: '#242323', stroke: '#d4c5a9' }, group);
      text(group, 255, 197, 'YOUR NAME', { fill: '#fff', 'font-size': 15 });
      addNote('Name tag: centered immediately above the right pocket; move to the equivalent sash position when covered.');
    }
  }

  function drawSleeves(earned) {
    // Sleeve placement uses 44 diagram units per inch; chest details are enlarged separately.
    let rightY = 741;
    if (checked('club-crest')) {
      image(sleeves, 'Right_Sleeve_Club_Crest.png', 167, 653, 176, 77, 'Club name crest');
      addNote('Right sleeve crest: centered 3/4 in below the shoulder seam; crest is 4 in wide.');
    }
    if (value('staff-strip')) {
      image(sleeves, 'Right_Sleeve_Role.png', 180, rightY, 150, 48, `${value('staff-strip')} sleeve strip`);
      rightY += 59;
      addNote(`Right sleeve role strip (${value('staff-strip')}): centered 1/4 in below the lowest point of the club crest; one strip only. The supplied artwork shows sample role text.`);
    }
    if (checked('triangle')) {
      image(sleeves, 'Right_Sleeve_Uniform_Triangle.png', 195, rightY, 120, 121, 'Pathfinder triangle patch');
      addNote('Right sleeve triangle: centered 1/4 in below the crest, or 1/4 in below the role strip when worn.');
    }
    let leftY = 708;
    if (checked('conference')) {
      image(sleeves, 'Left_Sleeve_Conference.png', 657, 631, 176, 73, 'Conference patch');
      leftY = 704;
      addNote('Left sleeve conference patch: centered 1/4 in below the shoulder seam; standard size 4 x 2 1/2 in.');
      if (checked('union')) {
        image(sleeves, 'Left_Sleeve_Union.png', 657, leftY, 176, 63, 'Union patch');
        leftY += 63;
        addNote('Union patch: directly below the conference patch with minimal space; standard size 4 x 1 in.');
      }
      leftY += 22;
    }
    if (checked('world')) {
      image(sleeves, 'Left_Sleeve_World_Patch.png', 667, leftY, 156, 116, 'Pathfinder World patch');
      addNote(checked('conference')
        ? 'Left sleeve World patch: 1/2 in below the conference patch (below the union patch when present), centered on the sleeve crease.'
        : 'Left sleeve World patch: 2 in below the shoulder seam when no conference patch is worn.');
    }
    leftY += 138;
    if (checked('show-chevrons')) {
      const master = checked('master-guide');
      if (master) {
        if (earned.length === 6) {
          image(sleeves, 'Left_Sleeve_Master_Guide_Combination_Chevron.png', 677, leftY, 136, 231, 'Master Guide star/chevron combination patch');
        } else {
          image(sleeves, 'Left_Sleeve_Master_Guide_Star.png', 711, leftY, 68, 63, 'Master Guide star patch');
        }
      }
      if (!master) {
        earned.slice().reverse().forEach(level => {
          const group = item(sleeves, `${level.name} sleeve chevron`);
          element('path', { d: `M677 ${leftY} l68 21 l68 -21 v17 l-68 21 l-68 -21 Z`, fill: level.color, stroke: '#ffcf00', 'stroke-width': 2 }, group);
          leftY += 17;
        });
      }
      if (master || earned.length) addNote('Left sleeve level insignia: starts 1/2 in below the World patch. Highest earned chevron at top, touching with no gaps. Master Guides use the star alone or the all-six combination.');
    }
  }

  function render() {
    constrainSelections();
    itemCount = 0;
    chest.replaceChildren();
    sleeves.replaceChildren();
    notes.replaceChildren();
    const earned = levels.filter(level => checked(`level-${level.name}`));
    const advanced = levels.filter(level => checked(`ribbon-${level.name}`));
    drawChest(earned, advanced);
    drawSleeves(earned);
    if (!itemCount) addNote('No insignia selected. Select items in the form to see their locations.');
    document.getElementById('selection-status').textContent = `${itemCount} ${itemCount === 1 ? 'item' : 'items'} shown`;
    const names = [...document.querySelectorAll('#uniform-preview [data-item]')].map(node => node.dataset.item);
    document.getElementById('uniform-description').textContent = names.length
      ? `Front view. Right chest and right sleeve appear on the left. Selected insignia: ${names.join('; ')}.`
      : 'Front view of empty chest pockets and sleeves. No insignia selected.';
  }

  addOptions();
  drawBase();
  form.addEventListener('input', render);
  form.addEventListener('change', render);
  form.addEventListener('submit', event => event.preventDefault());
  form.addEventListener('reset', () => requestAnimationFrame(render));
  document.getElementById('print-placement').addEventListener('click', () => window.print());
  render();
})();
