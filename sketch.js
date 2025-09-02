const simplex = `
vec3 hash33(vec3 p) { 
    float n = sin(dot(p, vec3(7, 157, 113)));    
    return fract(vec3(2097152, 262144, 32768)*n)*2. - 1.;
}

float simplex(in vec3 p)
{
    vec3 i = floor(p + dot(p, vec3(0.333333)) );  p -= i - dot(i, vec3(0.166666)) ;
    vec3 i1 = step(p.yzx, p), i2 = max(i1, 1.0-i1.zxy); i1 = min(i1, 1.0-i1.zxy);    
    vec3 p1 = p - i1 + 0.166666, p2 = p - i2 + 0.333333, p3 = p - 0.5;
    vec4 v = max(0.5 - vec4(dot(p,p), dot(p1,p1), dot(p2,p2), dot(p3,p3)), 0.0);
    vec4 d = vec4(dot(p, hash33(i)), dot(p1, hash33(i + i1)), dot(p2, hash33(i + i2)), dot(p3, hash33(i + 1.)));
    return clamp(dot(d, v*v*v*8.)*1.732 + .5, 0., 1.); // Not sure if clamping is necessary. Might be overkill.
}

vec2 smoothRepeatStart(float x, float size) {
  return vec2(
      mod(x - size / 2., size),
      mod(x, size)
  );
}

float smoothRepeatEnd(float a, float b, float x, float size) {
  return mix(a, b,
      smoothstep(
          0., 1.,
          sin((x / size) * PI * 2. - PI * .5) * .5 + .5
      )
  );
}

`;

const vert = `#version 300 es
  precision mediump float;
  in vec3 aPosition;
  in vec3 aNormal;
  in vec2 aTexCoord;

  uniform mat4 uModelViewMatrix;
  uniform mat4 uProjectionMatrix;
  uniform mat3 uNormalMatrix;

  out vec2 vertCoord;
  out float scale;
  

  void main(void) {
    vec4 position = vec4(aPosition, 1.0);
    gl_Position = uProjectionMatrix * 
                  uModelViewMatrix * 
                  position;
    vertCoord = aTexCoord;
  }
`;
const frag = `#version 300 es
  precision mediump float;
  in vec2 vertCoord;
  out vec4 fragColor;
  uniform sampler2D tex;
  uniform vec2 resolution;
  

#define PI 3.14159265359

uniform float levels;
uniform float angle;
uniform float frequency;
uniform float height;
uniform float spacing;
uniform float alias;
uniform float bright;
uniform float contrast;
uniform float blend;
uniform bool useRGB;
uniform bool useNoise;
uniform bool useLevels;
uniform float levelsAngle;
uniform float levelsContrast;
uniform float lineWidth;

uniform vec3 colorA;
uniform vec3 colorB;
const vec3 color = vec3(0.05,0.1,-0.15);

#define RGB useRGB
#define NOISE useNoise
#define R resolution
float luma(vec3 color) {
  return dot(color, vec3(0.299, 0.587, 0.114));
}

mat2 rotate2d(float angle) {
    return mat2(cos(angle),-sin(angle),
                sin(angle), cos(angle));
}

${simplex}


float balance(float sampled, float weight, float width) {
  if (weight < 1.0) weight = sampled + weight;
  return smoothstep(0.,1.,pow(weight, bright));
}

float distort(vec2 nuv){
  if(NOISE){
    return simplex(nuv.xxy * 1./(frequency + 360.)) * height * 2.;
  }else{
    return sin(nuv.x * 1./frequency )*height;
  }
}

float waves(float sampled) {
  vec2 pixel = floor(vec2(gl_FragCoord));
  pixel *= rotate2d(angle);
  float phase = pixel.y + distort(pixel);
  float c = spacing * 0.5;
  float d = abs(mod(phase, spacing) - c);
  float aa = fwidth(phase);
  float halfWidth = max(0.25, lineWidth * 0.5); // pixels
  float a = smoothstep(halfWidth - aa, halfWidth + aa, d);
  return balance(sampled, a, aa);
}

float wavesWithAngle(float sampled, float angleParam) {
  vec2 pixel = floor(vec2(gl_FragCoord));
  pixel *= rotate2d(angleParam);
  float phase = pixel.y + distort(pixel);
  float c = spacing * 0.5;
  float d = abs(mod(phase, spacing) - c);
  float aa = fwidth(phase);
  float halfWidth = max(0.25, lineWidth * 0.5); // pixels
  float a = smoothstep(halfWidth - aa, halfWidth + aa, d);
  return balance(sampled, a, aa);
}

void main(){
  vec2 uv = vertCoord;
  vec3 colored;
  if (useLevels) {
    int n = int(floor(levels + 0.5));
    n = clamp(n, 1, 8);
    float accum = 0.0;
    for (int i = 0; i < 8; i++) {
      if (i >= n) break;
      float angle_i = angle + float(i) * (levelsAngle == 0. ? 0. : PI/levelsAngle);
      float contrast_i = max(0.0001, contrast + float(i) * levelsContrast);
      float sampled_i = pow(luma(texture(tex, uv).rgb), contrast_i);
      float r_i = wavesWithAngle(sampled_i, angle_i);
      accum += r_i;
    }
    float result = accum / float(n);
    colored = mix(colorB, colorA, result);
  } else {
    float sampled = pow(luma(texture(tex,uv).rgb), contrast);
    float result = waves(sampled);
    colored = mix(colorB, colorA, result);
  }
  fragColor = vec4(colored, 1.0);

    
  
}
  `;

function preload() {
  img = loadImage(
    "https://cdn.shopify.com/s/files/1/0817/9308/9592/files/pexels-photo-507410.jpg?v=1721170628"
  );
}

let pos;
const settings = {
  useLevels: false,
  useNoise: false,
  needsUpdate: true,
  sliders: [],
  buttons: [],
};

function setup() {
  createCanvas(800, 500, WEBGL);
  noStroke();
  rectMode(CENTER);
  imageMode(CENTER);
  pg = createGraphics(width, height);
  pg.image(
    img,
    0,
    0,
    width,
    height,
    0,
    0,
    img.width,
    img.height,
    COVER,
    CENTER
  );
  renderShader = createShader(vert, frag);

  panel = createDiv()
    .position(0, 0)
    .style("width", "200px")
    .style("background-color", "#EEE")
    .style("height", `${height}px`)
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("gap", "8px")
    .style("padding", "8px");
  mainPanel = createDiv().style("width", "100%").parent(panel);
  buttonPanel = createDiv()
    .style("width", "100%")
    .style("height", "100%")
    .parent(panel);
  settings.sliders = [
    {
      name: "angle",
      val: 0,
      min: 0,
      max: Math.PI,
      step: 0.01,
      className: "",
    },
    { name: "frequency", val: 90, min: 1, max: 270, step: 1, className: "" },
    { name: "height", val: 80, min: 1, max: 200, step: 1, className: "" },
    { name: "spacing", val: 10, min: 8, max: 24, step: 0.1, className: "" },
    { name: "bright", val: 4, min: 1, max: 8, step: 0.1, className: "" },
    { name: "contrast", val: 2, min: 1, max: 8, step: 0.01, className: "" },
    { name: "blend", val: 0.6, min: 0, max: 1, step: 0.01, className: "" },
    {
      name: "lineWidth",
      val: 3.5,
      min: 0.25,
      max: 6,
      step: 0.05,
      className: "",
    },
    { name: "levels", val: 3, min: 1, max: 4, step: 1, className: "multi" },
    {
      name: "levelsAngle",
      val: 0,
      min: 0,
      max: 4,
      step: 0.5,
      className: "multi",
    },
    {
      name: "levelsContrast",
      val: 2,
      min: 1,
      max: 8,
      step: 0.01,
      className: "multi",
    },
  ].map((slider) => {
    const p = createDiv()
      .style("padding-top", "2px")
      .style("font-family", "sans-serif")
      .style("font-size", ".8rem")
      .class(`${slider.className === "multi" ? "multi" : ""}`);
    if (slider.className === "multi" && !settings.useLevels) {
      p.addClass("hidden");
    }
    const t = createP(slider.name).parent(p).style("margin", "0px");
    const e = createSlider(slider.min, slider.max, slider.val, slider.step)
      .parent(p)
      .style("width", "100%");
    p.parent(mainPanel);
    return [slider.name, e];
  });

  settings.buttons = [
    {
      name: "Sine/Noise",
      callback: () => {
        settings.useNoise = !settings.useNoise;
      },
      kind: "button",
    },
    {
      name: "PNG",
      callback: () => {
        save();
      },
      kind: "button",
    },
    { name: "LoadImage", callback: () => {}, kind: "file" },
    {
      name: "Multi-level",
      callback: () => {
        settings.useLevels = !settings.useLevels;
        document.querySelectorAll(".multi").forEach((el) => {
          if (settings.useLevels) {
            el.classList.remove("hidden");
          } else {
            el.classList.add("hidden");
          }
        });
      },
      kind: "button-class",
    },
    { name: "colorB", callback: () => {}, kind: "color", val: "#000" },
    { name: "colorA", callback: () => {}, kind: "color", val: "#fff" },
  ].map((button) => {
    let e = null;
    if (button.kind === "button") {
      e = createButton(`${button.name}`)
        .mousePressed(button.callback)
        .parent(buttonPanel);
    } else if (button.kind === "button-class") {
      e = createButton(`${button.name}`)
        .mousePressed(button.callback)
        .parent(buttonPanel)
        .class("");
    } else if (button.kind === "color") {
      e = createColorPicker(`${button.val}`).parent(buttonPanel);
    } else {
      e = createFileInput((file) => {
        if (file.type === "image") {
          img = createImg(file.data, "");
          settings.needsUpdate = true;
          img.hide();
        }
      }).parent(buttonPanel);
    }
    return [button.name, e];

    // return e
  });

  /*

*/
}
const hexToVec3 = (h) => (
  (h = h.replace(/^#/, "")),
  h.length == 3 && (h = h.replace(/./g, (x) => x + x)),
  [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
);

function fitCanvasToImage(img) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const maxW = vw - 64;
  const maxH = vh - 64;
  const imgAR = img.width / img.height;
  let newW, newH;
  if (imgAR > 1) {
    // wider than tall, fit horizontally
    newW = maxW;
    newH = newW / imgAR;
    if (newH > maxH) {
      newH = maxH;
      newW = newH * imgAR;
    }
  } else {
    // taller than wide, fit vertically
    newH = maxH;
    newW = newH * imgAR;
    if (newW > maxW) {
      newW = maxW;
      newH = newW / imgAR;
    }
  }
  resizeCanvas(Math.round(newW), Math.round(newH));
  pg.resizeCanvas(Math.round(newW), Math.round(newH));
}

function draw() {
  background(220);
  noStroke();

  const mx = constrain(mouseX, 0, width);
  const my = constrain(mouseY, 0, height);

  if (settings.needsUpdate) {
    fitCanvasToImage(img);
    pg.clear();
    pg.image(img, 0, 0, width, height);
    settings.needsUpdate = false;
  }

  const uniforms = {
    tex: pg,
    time: frameCount * 0.01,
    mouse: [mx, my, mouseIsPressed],
    resolution: [width, height],
    useRGB: settings.useRGB,
    useNoise: settings.useNoise,
    useLevels: settings.useLevels,
  };
  settings.sliders.forEach((slider) => {
    const [name, el] = slider;
    uniforms[name] = el.value();
  });
  settings.buttons.forEach((button) => {
    if (button[0] === "colorA" || button[0] === "colorB") {
      const [name, el] = button;
      uniforms[name] = hexToVec3(el.value());
    }
  });

  createUniforms(renderShader, uniforms);
  shader(renderShader);
  rect(0, 0, width, height);
}

const createUniforms = (shader, config) => {
  for (const uniform in config) {
    shader.setUniform(uniform, config[uniform]);
  }
};

function windowResized() {
  settings.needsUpdate = true;
}
