(() => {
  'use strict';

  const svgNS = 'http://www.w3.org/2000/svg';
  const assetPath = 'assets/adventurer-placement/';
  const form = document.getElementById('placement-form');
  const chest = document.getElementById('chest-items');
  const sleeves = document.getElementById('sleeve-items');
  const notes = document.getElementById('placement-notes');
  const levels = [
    { name: 'Little Lamb', file: 'Little_Lamb' },
    { name: 'Eager Beaver', file: 'Eager_Beaver' },
    { name: 'Busy Bee', file: 'Busy_Bee' },
    { name: 'Sunbeam', file: 'Sunbeam' },
    { name: 'Builder', file: 'Builder' },
    { name: 'Helping Hand', file: 'Helping_Hand' }
  ];
  const checked = id => document.getElementById(id).checked;
  const value = id => document.getElementById(id).value;
  const failedAssets = new Set();
  let itemCount = 0;

  function element(tag, attributes = {}, parent, content) {
    const node = document.createElementNS(svgNS, tag);
    for (const [key, val] of Object.entries(attributes)) node.setAttribute(key, String(val));
    if (content !== undefined) node.textContent = content;
    if (parent) parent.append(node);
    return node;
  }

  function text(parent, x, y, content, attributes = {}) {
    return element('text', { x, y, 'text-anchor': 'middle', 'font-family': 'system-ui, sans-serif',
      'font-size': 16, fill: '#162b35', ...attributes }, parent, content);
  }

  function image(parent, filename, x, y, width, height, name) {
    itemCount += 1;
    const group = element('g', { 'data-item': name }, parent);
    element('title', {}, group, name);
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
    for (const [target, prefix] of [['level-options', 'level'], ['parent-options', 'parent']]) {
      levels.forEach(level => {
        const label = document.createElement('label');
        label.className = 'check';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = `${prefix}-${level.file}`;
        input.name = input.id;
        label.append(input, level.name);
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
    }
    text(base, 255, 535, 'Right pocket', { class: 'diagram-note' });
    text(base, 745, 535, 'Left pocket', { class: 'diagram-note' });
    const sleeveBase = document.getElementById('sleeve-base');
    for (const x of [125, 615]) {
      element('path', { d: `M${x} 1230 V700 Q${x} 620 ${x + 130} 620 Q${x + 260} 620 ${x + 260} 700 V1230 Z`, class: 'sleeve' }, sleeveBase);
      element('path', { d: `M${x + 12} 1216 h236 M${x + 130} 625 v590`, class: 'seam' }, sleeveBase);
      text(sleeveBase, x + 130, 612, 'Shoulder seam', { class: 'diagram-note' });
    }
  }

  function constrainSelections() {
    const staff = value('wearer') === 'staff';
    const parent = value('wearer') === 'parent';
    document.querySelectorAll('[data-uniform-options]').forEach(fieldset => {
      fieldset.hidden = parent;
      fieldset.disabled = parent;
    });
    const parentFieldset = document.getElementById('parent-fieldset');
    parentFieldset.hidden = !parent;
    parentFieldset.disabled = !parent;
    levels.forEach(level => {
      const control = document.getElementById(`parent-${level.file}`);
      control.disabled = !parent;
      if (!parent) control.checked = false;
    });
    if (parent) return;

    const availability = (id, available) => {
      const control = document.getElementById(id);
      control.disabled = !available;
      if (!available) control.checked = false;
    };
    for (const id of ['master-guide', 'baptismal', 'service', 'staff-strip']) availability(id, staff);
    availability('union', checked('conference'));
    const masterName = document.querySelector('#nameplate [value="master-guide"]');
    masterName.disabled = !staff;
    if (!staff && value('nameplate') === 'master-guide') document.getElementById('nameplate').value = '';
  }

  function drawParentPins() {
    const parents = levels.filter(level => checked(`parent-${level.file}`));
    parents.forEach((level, index) => {
      image(chest, `Adv_Parent_Pin_${level.file}.png`,
        745 - (parents.length * 36 - 4) / 2 + index * 36, 250, 32, 26, `${level.name} parent pin`);
    });
    if (parents.length) addNote('Parent pins: shown near the top of the left pocket for illustration only; check local placement guidance.');
  }

  function drawChest() {
    if (checked('master-guide')) {
      image(chest, 'Adv_Left_Pocket_Master_Guide_Name_Strip.png', 660, 152, 170, 56, 'Master Guide name strip');
      image(chest, 'Adv_Left_Pocket_Master_Guide_Pin.png', 729, 230, 32, 32, 'Master Guide pin');
      addNote('Master Guide: name strip above the left pocket and pin on the pocket.');
    }
    const earned = levels.filter(level => checked(`level-${level.file}`));
    earned.forEach((level, index) => {
      image(chest, `Adv_Left_Pocket_${level.file}_Level_Pin.png`,
        745 - (earned.length * 34 - 4) / 2 + index * 34, 269, 30, 30, `${level.name} class pin`);
    });
    if (earned.length) addNote('Class pins: on the left pocket in ascending order, lowest toward the center of the shirt.');
    if (checked('baptismal')) {
      image(chest, 'Adv_Left_Pocket_Baptismal_Pin.png', 611, 310, 28, 26, 'Staff baptismal pin');
      addNote('Staff baptismal pin: position A on the left pocket flap, as in the Pathfinder preview.');
    }
    if (checked('service')) {
      image(chest, 'Adv_Left_Pocket_Service_Star.png', 846, 305, 38, 37, 'Staff service star');
      addNote('Staff service star: at position D on the left pocket flap, as in the Pathfinder preview. Artwork shows year 7; verify local guidance.');
    }
    if (value('nameplate')) {
      const master = value('nameplate') === 'master-guide';
      image(chest, master ? 'Adv_Right_Pocket_Master_Guide_Name_Badge_.jpg' : 'Adv_Right_Pocket_Adventurer_Name_Badge.png',
        145, 150, 220, 61, master ? 'Master Guide name tag' : 'Adventurer name tag');
      addNote('Name tag: centered above the right pocket or in the equivalent position on the sash.');
    }
  }

  function drawSleeves() {
    if (checked('club-crest')) {
      image(sleeves, 'Adv_Right_Sleeve_Club_Crest.png', 167, 647, 176, 77, 'Club name crest');
      addNote('Right sleeve crest: 1/2 inch below the shoulder.');
    }
    if (checked('staff-strip')) {
      image(sleeves, 'Adv_Right_Sleeve_Staff_Strip.png', 180, 735, 150, 43, 'Staff role strip');
      addNote('Staff role strip: between the crest and club patch; move the club patch down an additional inch.');
    }
    if (checked('club-patch')) {
      image(sleeves, 'Adv_Right_Sleeve_Uniform_Patch.png', 172.5, checked('staff-strip') ? 810 : 766, 165, 154, 'Adventurer club patch');
      addNote('Right sleeve Adventurer patch: 2 1/2 inches below the shoulder, plus one inch when a staff strip is worn.');
    }
    let leftY = 686;
    if (checked('conference')) {
      image(sleeves, 'Adv_Left_Sleeve_Conference.png', 657, 631, 176, 73, 'Conference patch');
      leftY = 704;
      if (checked('union')) {
        image(sleeves, 'Adv_Left_Sleeve_Union.png', 657, leftY, 176, 63, 'Union patch');
        leftY += 63;
        addNote('Union patch: directly below the conference patch, following the Pathfinder preview.');
      }
      leftY += 22;
      addNote('Conference patch: shown above the World patch, following the Pathfinder preview.');
    }
    if (checked('world')) {
      image(sleeves, 'Adv_Left_Sleeve_World_Patch.png', 667, leftY, 156, 106, 'Adventurer World patch');
      addNote(checked('conference') ? 'World patch: shown below the conference / union patches; check local guidance.' : 'World patch: 1 1/2 inches below the shoulder.');
      leftY += 128;
    }
    if (checked('master-guide')) {
      image(sleeves, 'Adv_Left_Sleeve_Master_Guide_Star_Chevron.png', 677, leftY, 136, 231, 'Adventurer Master Guide star / chevron');
      addNote('Adventurer Master Guide star / chevron: shown below the World patch; check local placement guidance.');
    }
  }

  function render() {
    constrainSelections();
    document.getElementById('uniform-preview').dataset.wearer = value('wearer');
    itemCount = 0;
    chest.replaceChildren();
    sleeves.replaceChildren();
    notes.replaceChildren();
    if (value('wearer') === 'parent') {
      drawParentPins();
    } else {
      drawChest();
      drawSleeves();
    }
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
