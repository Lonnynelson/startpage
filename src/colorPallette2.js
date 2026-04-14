// Wait for the DOM to be fully loaded before executing code
document.addEventListener('DOMContentLoaded', function() {
    // Get references to DOM elements we'll need to manipulate
    const colourPicker = document.getElementById('colourPicker');      // The colour picker input
    const colourPalette = document.getElementById('colourPalette');    // Container for colour cards
    const harmonyButtons = document.querySelectorAll('.harmony-options button'); // Harmony selection buttons
    const alert = document.getElementById('alert');                    // Notification for clipboard copying
  
    // Track the currently selected harmony type
    let currentHarmony = 'analogous';  // Default harmony type on page load
  
    // Generate initial palette on page load
    generatePalette();
  
    // ===== EVENT LISTENERS =====
  
    // Update the palette whenever the colour picker value changes
    colourPicker.addEventListener('input', generatePalette);
  
    // Set up event handlers for each harmony type button
    harmonyButtons.forEach(button => {
      button.addEventListener('click', function() {
        // Remove active class from all buttons
        harmonyButtons.forEach(btn => btn.classList.remove('active'));
  
        // Add active class to the clicked button
        this.classList.add('active');
  
        // Update current harmony type from data attribute
        currentHarmony = this.dataset.harmony;
  
        // Regenerate the palette with the new harmony type
        generatePalette();
      });
    });
  
    // ===== COLOUR CONVERSION UTILITIES =====
  
    /**
         * Converts a hexadecimal colour string to RGB values
         * @param {string} hex - Hex colour code (with or without # prefix)
         * @returns {object|null} Object with r, g, b properties or null if invalid
         */
    function hexToRgb(hex) {
      // Handle shorthand hex format (e.g. #FFF instead of #FFFFFF)
      const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
      hex = hex.replace(shorthandRegex, function(_, r, g, b) {
        return r + r + g + g + b + b;
      });
  
      // Extract the RGB components using regex
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  
      // Return as an object with decimal values
      return result ? {
        r: parseInt(result[1], 16), // Red (0-255)
        g: parseInt(result[2], 16), // Green (0-255)
        b: parseInt(result[3], 16)  // Blue (0-255)
      } : null;
    }
  
    /**
         * Converts RGB values to HSL colour space 
         * @param {number} r - Red component (0-255)
         * @param {number} g - Green component (0-255)
         * @param {number} b - Blue component (0-255)
         * @returns {object} Object with h (0-360), s (0-100), l (0-100)
         */
    function rgbToHsl(r, g, b) {
      // Normalize RGB values to 0-1 range
      r /= 255;
      g /= 255;
      b /= 255;
  
      // Find the maximum and minimum values to determine saturation
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
  
      // Initialize hue, saturation, and lightness
      let h, s, l = (max + min) / 2;
  
      if (max === min) {
        // Achromatic (grey) - no hue or saturation
        h = s = 0;
      } else {
        // Calculate saturation
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  
        // Calculate hue
        switch (max) {
          case r: // Red is max
            h = (g - b) / d + (g < b ? 6 : 0);
            break;
          case g: // Green is max
            h = (b - r) / d + 2;
            break;
          case b: // Blue is max
            h = (r - g) / d + 4;
            break;
        }
  
        // Convert hue to 0-1 range
        h /= 6;
      }
  
      // Return HSL values in their standard ranges
      return {
        h: Math.round(h * 360), // Hue: 0-360 degrees
        s: Math.round(s * 100), // Saturation: 0-100%
        l: Math.round(l * 100)  // Lightness: 0-100%
      };
    }
  
    /**
         * Converts HSL values to RGB colour space
         * @param {number} h - Hue in degrees (0-360)
         * @param {number} s - Saturation percentage (0-100)
         * @param {number} l - Lightness percentage (0-100)
         * @returns {object} Object with r, g, b components (0-255)
         */
    function hslToRgb(h, s, l) {
      // Normalize HSL values to ranges expected by the algorithm
      h /= 360;  // 0-1 instead of 0-360
      s /= 100;  // 0-1 instead of 0-100%
      l /= 100;  // 0-1 instead of 0-100%
  
      let r, g, b;
  
      if (s === 0) {
        // Achromatic (grey) - same value for all components
        r = g = b = l;
      } else {
        // Helper function for the conversion
        const hue2rgb = (p, q, t) => {
          // Ensure t is wrapped to 0-1 range
          if (t < 0) t += 1;
          if (t > 1) t -= 1;
  
          // Apply the formula based on which sector of the colour wheel we're in
          if (t < 1/6) return p + (q - p) * 6 * t;
          if (t < 1/2) return q;
          if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
          return p;
        };
  
        // Calculate temporary values based on lightness and saturation
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
  
        // Calculate RGB components
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
      }
  
      // Convert back to 0-255 range and return
      return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255)
      };
    }
  
    /**
         * Converts RGB values to hexadecimal colour string
         * @param {number} r - Red component (0-255)
         * @param {number} g - Green component (0-255)
         * @param {number} b - Blue component (0-255)
         * @returns {string} Hex colour code with # prefix, uppercase
         */
    function rgbToHex(r, g, b) {
      // Use bit shifting to generate the hex value and format it
      return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
    }
  
    // ===== PALETTE GENERATION =====
  
    /**
         * Main function that generates the colour palette based on selected harmony
         * Gets the base colour, converts it to HSL, generates harmonious colours,
         * and renders the palette to the DOM
         */
    function generatePalette() {
      // Get current value from colour picker and convert to HSL
      const baseColour = colourPicker.value;
      const rgb = hexToRgb(baseColour);
      const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  
      // Array to hold the generated colours
      let colours = [];
  
      // Generate colours based on selected harmony type
      switch(currentHarmony) {
        case 'analogous':
          colours = generateAnalogous(hsl);
          break;
        case 'monochromatic':
          colours = generateMonochromatic(hsl);
          break;
        case 'triadic':
          colours = generateTriadic(hsl);
          break;
        case 'complementary':
          colours = generateComplementary(hsl);
          break;
        case 'split-complementary':
          colours = generateSplitComplementary(hsl);
          break;
        default:
          colours = generateAnalogous(hsl); // Fallback
      }
  
      // Render the palette to the DOM
      renderPalette(colours);
    }
  
    /**
         * Generate analogous colours - colours adjacent to each other on the colour wheel
         * @param {object} hsl - Base colour in HSL format {h, s, l}
         * @returns {array} Array of 5 HSL colour objects
         */
    function generateAnalogous(hsl) {
      const colours = [];
      const hue = hsl.h;
  
      // Generate 5 colours: -60°, -30°, 0°, +30°, +60° around the base hue
      for (let i = -2; i <= 2; i++) {
        // Calculate new hue (with wrap-around for <0 or >360)
        let newHue = (hue + i * 30 + 360) % 360;
  
        // Slightly vary saturation for more visual interest
        let newSat = Math.max(Math.min(hsl.s + i * 5, 100), 20);
  
        // Add the new colour to our array
        colours.push({
          h: newHue,
          s: newSat,
          l: hsl.l
        });
      }
  
      return colours;
    }
  
    /**
         * Generate monochromatic colours - variations of the same hue with different
         * saturation and lightness values
         * @param {object} hsl - Base colour in HSL format {h, s, l}
         * @returns {array} Array of 5 HSL colour objects
         */
    function generateMonochromatic(hsl) {
      const colours = [];
      const hue = hsl.h;
  
      // Create variations by adjusting saturation and lightness
      // Darker, more saturated version
      colours.push({ h: hue, s: Math.min(hsl.s + 20, 100), l: Math.max(hsl.l - 30, 15) });
  
      // Slightly darker, more saturated version
      colours.push({ h: hue, s: Math.min(hsl.s + 10, 100), l: Math.max(hsl.l - 15, 20) });
  
      // Base colour
      colours.push({ h: hue, s: hsl.s, l: hsl.l });
  
      // Slightly lighter, less saturated version
      colours.push({ h: hue, s: Math.max(hsl.s - 10, 20), l: Math.min(hsl.l + 15, 85) });
  
      // Lightest, least saturated version
      colours.push({ h: hue, s: Math.max(hsl.s - 20, 10), l: Math.min(hsl.l + 30, 90) });
  
      return colours;
    }
  
    /**
         * Generate triadic colours - three hues spaced evenly around the colour wheel (120° apart)
         * @param {object} hsl - Base colour in HSL format {h, s, l}
         * @returns {array} Array of 5 HSL colour objects
         */
    function generateTriadic(hsl) {
      const colours = [];
      const hue = hsl.h;
  
      // Create a darker variation of the first colour
      colours.push({ h: hue, s: hsl.s, l: Math.max(hsl.l - 10, 15) });
  
      // Add the base colour
      colours.push({ h: hue, s: hsl.s, l: hsl.l });
  
      // Add the second triadic colour (120° from base)
      const hue2 = (hue + 120) % 360;
      colours.push({ h: hue2, s: hsl.s, l: hsl.l });
  
      // Add the third triadic colour (240° from base)
      const hue3 = (hue + 240) % 360;
      colours.push({ h: hue3, s: hsl.s, l: hsl.l });
  
      // Add a lighter variation of the third colour
      colours.push({ h: hue3, s: hsl.s, l: Math.min(hsl.l + 10, 90) });
  
      return colours;
    }
  
    /**
         * Generate complementary colours - using the base colour and its opposite
         * on the colour wheel (180° apart)
         * @param {object} hsl - Base colour in HSL format {h, s, l}
         * @returns {array} Array of 5 HSL colour objects
         */
    function generateComplementary(hsl) {
      const colours = [];
      const hue = hsl.h;
  
      // Calculate the complementary hue (opposite on the colour wheel)
      const complementHue = (hue + 180) % 360;
  
      // Add a darker, more saturated version of the base colour
      colours.push({ h: hue, s: Math.min(hsl.s + 5, 100), l: Math.max(hsl.l - 10, 20) });
  
      // Add the base colour
      colours.push({ h: hue, s: hsl.s, l: hsl.l });
  
      // Add a lighter, less saturated version of the base colour
      colours.push({ h: hue, s: Math.max(hsl.s - 5, 20), l: Math.min(hsl.l + 10, 85) });
  
      // Add the complementary colour
      colours.push({ h: complementHue, s: hsl.s, l: hsl.l });
  
      // Add a lighter, less saturated version of the complementary colour
      colours.push({ h: complementHue, s: Math.max(hsl.s - 5, 20), l: Math.min(hsl.l + 10, 85) });
  
      return colours;
    }
  
    /**
         * Generate split-complementary colours - base colour plus two colours
         * adjacent to its complement (150° and 210° from base)
         * @param {object} hsl - Base colour in HSL format {h, s, l}
         * @returns {array} Array of 5 HSL colour objects
         */
    function generateSplitComplementary(hsl) {
      const colours = [];
      const hue = hsl.h;
  
      // Calculate the complementary hue
      const complement = (hue + 180) % 360;
  
      // Calculate the split complementary hues (30° on either side of complement)
      const split1 = (complement - 30 + 360) % 360;  // Add 360 and % 360 to handle negative values
      const split2 = (complement + 30) % 360;
  
      // Add a darker, more saturated version of base colour
      colours.push({ h: hue, s: Math.min(hsl.s + 5, 100), l: Math.max(hsl.l - 5, 20) });
  
      // Add the base colour
      colours.push({ h: hue, s: hsl.s, l: hsl.l });
  
      // Add first split complementary
      colours.push({ h: split1, s: hsl.s, l: hsl.l });
  
      // Add second split complementary
      colours.push({ h: split2, s: hsl.s, l: hsl.l });
  
      // Add a darker variation of second split complementary
      colours.push({ h: split2, s: Math.min(hsl.s + 5, 100), l: Math.max(hsl.l - 5, 20) });
  
      return colours;
    }
  
    /**
         * Renders the generated colour palette to the DOM
         * Creates colour cards with previews and information for each colour
         * @param {array} colours - Array of HSL colour objects
         */
    function renderPalette(colours) {
      // Clear any existing palette
      colourPalette.innerHTML = '';
  
      // Create a card for each colour in the palette
      colours.forEach(colour => {
        // Convert from HSL to RGB and HEX for display
        const rgb = hslToRgb(colour.h, colour.s, colour.l);
        const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
  
        // Create the main card container
        const card = document.createElement('div');
        card.className = 'colour-card';
  
        // Create the colour preview area
        const preview = document.createElement('div');
        preview.className = 'colour-preview';
        preview.style.backgroundColor = hex;
  
        // Create the colour information container
        const info = document.createElement('div');
        info.className = 'colour-info';
  
        // Add the hex code with copy button
        const hexInfo = document.createElement('div');
        hexInfo.className = 'colour-hex';
        hexInfo.innerHTML = `
              ${hex}
              <button class="copy-btn" data-colour="${hex}" title="Copy HEX">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>
            `;
  
        // Add RGB information
        const rgbInfo = document.createElement('div');
        rgbInfo.className = 'colour-rgb';
        rgbInfo.textContent = `RGB: ${rgb.r}, ${rgb.g}, ${rgb.b}`;
  
        // Add HSL information
        const hslInfo = document.createElement('div');
        hslInfo.className = 'colour-hsl';
        hslInfo.textContent = `HSL: ${colour.h}°, ${colour.s}%, ${colour.l}%`;
  
        // Assemble the card components
        info.appendChild(hexInfo);
        info.appendChild(rgbInfo);
        info.appendChild(hslInfo);
  
        card.appendChild(preview);
        card.appendChild(info);
  
        // Add the completed card to the palette
        colourPalette.appendChild(card);
      });
  
      // Add event listeners to copy buttons
      document.querySelectorAll('.copy-btn').forEach(button => {
        button.addEventListener('click', function() {
          // Get the colour value from the data attribute
          const colour = this.dataset.colour;
  
          // Copy to clipboard using the Clipboard API
          navigator.clipboard.writeText(colour)
            .then(() => {
            // Show success notification
            showAlert();
          })
            .catch(err => {
            // Log errors to console
            console.error('Could not copy text: ', err);
          });
        });
      });
    }
  
    /**
         * Shows a notification alert when a colour is copied to clipboard
         * Alert automatically dismisses after 2 seconds
         */
    function showAlert() {
      // Show the alert
      alert.classList.add('show');
  
      // Set a timer to hide the alert
      setTimeout(() => {
        alert.classList.remove('show');
      }, 2000); // 2 seconds
    }
  });