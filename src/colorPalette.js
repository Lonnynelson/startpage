//Global selections and variables
const colorDivs = document.querySelectorAll(".color");
const generateBtn = document.querySelector(".generate ");
const sliders = document.querySelectorAll('input[type="range"]');
const currentHexes = document.querySelectorAll(".color h2");
const popup = document.querySelector(".copy-container");
const adjustButton = document.querySelectorAll(".adjust");
const lockButton = document.querySelectorAll(".lock");
const closeAdjustments = document.querySelectorAll(".close-adjustment");
const sliderContainers = document.querySelectorAll(".sliders");
let initialColors;

//Event listeners
generateBtn.addEventListener("click", randomColors);

sliders.forEach((slider) => {
  slider.addEventListener("input", hslControls);
});

colorDivs.forEach((div, index) => {
  div.addEventListener("change", () => {
    updateTextUI(index);
  });
});

currentHexes.forEach((hex) => {
  hex.addEventListener("click", () => {
    copyToClipboard(hex);
  });
});

popup.addEventListener("transitionend", () => {
  const popupBox = popup.children[0];
  popup.classList.remove("active");
  popupBox.classList.remove("active");
});

adjustButton.forEach((button, index) => {
  button.addEventListener("click", () => {
    openAdjustmentPanel(index);
  });
});

lockButton.forEach((button, index) => {
  button.addEventListener("click", () => {
    addLock(index);
  });
});

//FUNCTIONS
//color generator
function generateHex() {
  //TRADITIONAL WAY
  // const letters = "0123456789ABCDEF";
  // let hash = "#";
  // for (let i = 0; i < 6; i++) {
  //   hash += letters[Math.floor(Math.random() * 16)];
  // }
  // return hash;
  const randomHex = chroma.random();
  return randomHex;
}
function addLock(index) {
  colorDivs[index].classList.toggle("locked");
  lockButton[index].children[0].classList.toggle("fa-lock-open");
  lockButton[index].children[0].classList.toggle("fa-lock");
}

function randomColors() {
  initialColors = [];
  colorDivs.forEach((div, index) => {
    const hexText = div.children[0];
    const randomColor = generateHex();
    if (div.classList.contains("locked")) {
      initialColors.push(hexText.innerText);
      return;
    } else {
      initialColors.push(chroma(randomColor).hex());
    }

    //add color to the bg and text
    div.style.backgroundColor = randomColor;
    hexText.innerText = randomColor;
    //check for contrast
    checkTextContrast(randomColor, hexText);
    //initial colorize sliders
    const color = chroma(randomColor);
    const sliders = div.querySelectorAll(".sliders input");
    const hue = sliders[0];
    const brightness = sliders[1];
    const saturation = sliders[2];

    colorizeSliders(color, hue, brightness, saturation);
  });
  //reset sliders
  resetInputs();
  //check contast on buttons
  adjustButton.forEach((button, index) => {
    checkTextContrast(initialColors[index], button);
    checkTextContrast(initialColors[index], lockButton[index]);
  });
}
function checkTextContrast(color, text) {
  const luminance = chroma(color).luminance();
  if (luminance > 0.5) {
    text.style.color = "black";
  } else {
    text.style.color = "white";
  }
}
function colorizeSliders(color, hue, brightness, saturation) {
  //scale saturation
  const noSat = color.set("hsl.s", 0);
  const fullSat = color.set("hsl.s", 1);
  const scaleSat = chroma.scale([noSat, color, fullSat]);
  //scale brightness
  const midBright = color.set("hsl.l", 0.5);
  const scaleBright = chroma.scale(["black", midBright, "white"]);
  //scale hue
  const scaleHue = chroma.scale([
    "red",
    "orange",
    "yellow",
    "green",
    "cyan",
    "blue",
    "purple",
    "red",
  ]);
  //update input colors
  saturation.style.backgroundImage = `linear-gradient(to right, ${scaleSat(
    0
  )}, ${scaleSat(1)})`;
  brightness.style.backgroundImage = `linear-gradient(to right, black, ${scaleBright(
    0.5
  )}, white)`;
  hue.style.backgroundImage = `linear-gradient(to right, ${scaleHue(
    0
  )}, ${scaleHue(0.1)}, ${scaleHue(0.2)},${scaleHue(0.3)},${scaleHue(
    0.4
  )},${scaleHue(0.5)},${scaleHue(0.6)},${scaleHue(0.7)},${scaleHue(
    0.8
  )},${scaleHue(0.9)},${scaleHue(1)})`;
}
function hslControls(e) {
  const index =
    e.target.getAttribute("data-hue") ||
    e.target.getAttribute("data-sat") ||
    e.target.getAttribute("data-bright");

  let sliders = e.target.parentElement.querySelectorAll('input[type="range"]');
  const hue = sliders[0];
  const bright = sliders[1];
  const sat = sliders[2];

  const bgColor = initialColors[index];

  let color = chroma(bgColor)
    .set("hsl.h", hue.value)
    .set("hsl.s", sat.value)
    .set("hsl.l", bright.value);

  colorDivs[index].style.backgroundColor = color;

  //colorize inputs
  colorizeSliders(color, hue, bright, sat);
}

function updateTextUI(index) {
  const activeDiv = colorDivs[index];
  const color = chroma(activeDiv.style.backgroundColor);
  const textHex = activeDiv.querySelector("h2");
  const icons = activeDiv.querySelectorAll(".controls button");
  textHex.innerText = color.hex();
  //check contrast
  checkTextContrast(color, textHex);
  for (icon of icons) {
    checkTextContrast(color, icon);
  }
}
function resetInputs() {
  const sliders = document.querySelectorAll(".sliders input");
  sliders.forEach((slider) => {
    if (slider.name === "hue") {
      const hueColor = initialColors[slider.getAttribute("data-hue")];
      const hueValue = chroma(hueColor).hsl()[0];
      slider.value = Math.floor(hueValue);
    }
    if (slider.name === "brightness") {
      const brightColor = initialColors[slider.getAttribute("data-bright")];
      const brightValue = chroma(brightColor).hsl()[2];

      slider.value = Math.floor(brightValue * 100) / 100;
    }
    if (slider.name === "saturation") {
      const satColor = initialColors[slider.getAttribute("data-sat")];
      const satValue = chroma(satColor).hsl()[1];
      slider.value = Math.floor(satValue * 100) / 100;
    }
  });
}
function copyToClipboard(hex) {
  const el = document.createElement("textarea");
  el.value = hex.innerText;
  document.body.appendChild(el);
  el.select();
  document.execCommand("copy");
  document.body.removeChild(el);
  //popup animation
  const popupBox = popup.children[0];
  popup.classList.add("active");
  popupBox.classList.add("active");
}
function openAdjustmentPanel(index) {
  sliderContainers[index].classList.toggle("active");
  //adding event listener to slider closing button
  sliderContainers[index].children[0].addEventListener("click", () => {
    sliderContainers[index].classList.remove("active");
  });
}
//implement save to palette and local storage
const saveBtn = document.querySelector(".save");
const submitSave = document.querySelector(".submit-save");
const closeSave = document.querySelector(".close-save");
const saveContainer = document.querySelector(".save-container");
const saveInput = document.querySelector(".save-container input");
const libraryContainer = document.querySelector('.library-container')
const libraryBtn = document.querySelector('.library')
const closeLibratyBtn = document.querySelector('.close-library')
//for local storage
let savedPalettes = [];

//Event listeners
saveBtn.addEventListener("click", openPalette);
closeSave.addEventListener("click", closePalette);
submitSave.addEventListener("click", savePalette);

libraryBtn.addEventListener('click' , openLibrary);
closeLibratyBtn.addEventListener('click', closeLibrary)


//Functions
function openPalette(e) {
  const popup = saveContainer.children[0];
  saveContainer.classList.add("active");
  popup.classList.add("active");
}

function closePalette(e) {
  const popup = saveContainer.children[0];
  saveContainer.classList.remove("active");
  popup.classList.remove("active");
}

function savePalette(e) {
  closePalette();
  const name = saveInput.value;
  const colors = [];
  currentHexes.forEach((hex) => {
    colors.push(hex.innerText);
  });
  //generate object of saved palletes
  let paletteNr;
  const paletteObjets = JSON.parse(localStorage.getItem('palettes'))
  if(paletteObjets){
    paletteNr = paletteObjets.length;
  }else{
    paletteNr = savedPalettes.length;
  }
  
  const paletteObj = { name, colors, nr: paletteNr };
  savedPalettes.push(paletteObj);
  //save to local storage
  savetoLocal(paletteObj);
  saveInput.value = "";

  //generate pallete for library
  const palette = document.createElement("div");
  palette.classList.add("custom-palette");
  const title = document.createElement("h4");
  title.innerText = paletteObj.name;
  const preview = document.createElement("div");
  preview.classList.add("small-preview");
  paletteObj.colors.forEach((smallColor) => {
    const smallDiv = document.createElement("div");
    smallDiv.style.backgroundColor = smallColor;
    preview.appendChild(smallDiv);
  });
  const paletteBtn = document.createElement("button");
  paletteBtn.classList.add("pick-palette-btn");
  paletteBtn.classList.add(paletteObj.nr);
  paletteBtn.innerText = "Select"
  const deleteBtn = document.createElement('button');
  deleteBtn.classList.add('delete-palete-btn');
  deleteBtn.classList.add(paletteObj.nr)
  deleteBtn.innerText = 'Delete'
  
  paletteBtn.addEventListener('click', e => {
      closeLibrary();
      const paletteIndex = e.target.classList[1];
      initialColors = [];
      savedPalettes[paletteIndex].colors.forEach((color, index) => {
        initialColors.push(color);
        colorDivs[index].style.backgroundColor = color;
        const text = colorDivs[index].children[0]
        checkTextContrast(color, text)
        updateTextUI(index)
        libraryUpdate(color,index);
      })
    resetInputs()
  })

  deleteBtn.addEventListener('click', e =>{
    const index = e.target.classList[1]
    console.log(index)
    const parent = e.target.parentElement;
    const storage = JSON.parse(localStorage.getItem('palettes'))
    console.log(storage)
    const toMemory = storage.filter(obj => {
      return obj.nr !== parseInt(index, 10)
    })
    
    localStorage.setItem('palettes', JSON.stringify(toMemory))
    parent.remove()
  })
  
  //append to library
  palette.appendChild(title);
  palette.appendChild(preview);
  palette.appendChild(paletteBtn);
  palette.appendChild(deleteBtn)
  libraryContainer.children[0].appendChild(palette)

}

function savetoLocal(obj) {
  let localPalettes;
  if (localStorage.getItem("palettes") === null) {
    localPalettes = [];
  } else {
    localPalettes = JSON.parse(localStorage.getItem("palettes"));
  }
  localPalettes.push(obj);
  localStorage.setItem("palettes", JSON.stringify(localPalettes));
}

function openLibrary(){
  const popup = libraryContainer.children[0];
  libraryContainer.classList.add('active')
  popup.classList.add('active')
}
function closeLibrary(){
  const popup = libraryContainer.children[0];
  libraryContainer.classList.remove('active')
  popup.classList.remove('active')
}

function getLocal(){
  let localPalettes;
  if(localStorage.getItem('palettes') === null){
    localPalettes = []
  }else{
    const paletteObject = JSON.parse(localStorage.getItem('palettes'));
    
    savedPalettes = [...paletteObject]
    
    paletteObject.forEach(paletteObj => {
      //generate pallete for library
  const palette = document.createElement("div");
  palette.classList.add("custom-palette");
  const title = document.createElement("h4");
  title.innerText = paletteObj.name;
  const preview = document.createElement("div");
  preview.classList.add("small-preview");
  paletteObj.colors.forEach((smallColor) => {
    const smallDiv = document.createElement("div");
    smallDiv.style.backgroundColor = smallColor;
    preview.appendChild(smallDiv);
  });
  const paletteBtn = document.createElement("button");
  paletteBtn.classList.add("pick-palette-btn");
  paletteBtn.classList.add(paletteObj.nr);
  paletteBtn.innerText = "Select"
  const deleteBtn = document.createElement('button');
  deleteBtn.classList.add('delete-palete-btn');
  deleteBtn.classList.add(paletteObj.nr)
  deleteBtn.innerText = 'Delete'
  
  paletteBtn.addEventListener('click', e => {
      closeLibrary();
      const paletteIndex = e.target.classList[1];
      initialColors = [];
      paletteObject[paletteIndex].colors.forEach((color, index) => {
        initialColors.push(color);
        colorDivs[index].style.backgroundColor = color;
        const text = colorDivs[index].children[0]
        checkTextContrast(color, text)
        updateTextUI(index)
        libraryUpdate(color,index);
      })
    resetInputs()
  })
  deleteBtn.addEventListener('click', e =>{
    const index = e.target.classList[1]
    console.log(index)
    const parent = e.target.parentElement;
    const storage = JSON.parse(localStorage.getItem('palettes'))
    console.log(storage)
    const toMemory = storage.filter(obj => {
      return obj.nr !== parseInt(index, 10)
    })
    
    localStorage.setItem('palettes', JSON.stringify(toMemory))
    parent.remove()
  })

  //append to library
  palette.appendChild(title);
  palette.appendChild(preview);
  palette.appendChild(paletteBtn);
  palette.appendChild(deleteBtn)
  libraryContainer.children[0].appendChild(palette)
    })
  }
}
function libraryUpdate(color, index){
  const c = chroma(color)
  let sliders = sliderContainers[index].querySelectorAll('input[type="range"]');
  const hue = sliders[0];
  const bright = sliders[1];
  const sat = sliders[2];
  colorizeSliders(c, hue, bright, sat)
}



getLocal()

randomColors();
