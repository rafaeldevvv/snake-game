import scale from "./scale.js";

export function elt(type, attrs, ...children) {
  const domElement = document.createElement(type);
  if (attrs) Object.assign(domElement, attrs);

  for (const child of children) {
    if (typeof child === "string") {
      domElement.appendChild(document.createTextNode(child));
    } else {
      domElement.appendChild(child);
    }
  }

  return domElement;
}

export function overlap(actor1, actor2) {
  return (
    Math.floor(actor1.position.x) === Math.floor(actor2.position.x) &&
    Math.floor(actor1.position.y) === Math.floor(actor2.position.y)
  );
}

export function drawChessBackground(context, width, height, color1, color2) {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      context.fillStyle = (x + y) % 2 === 0 ? color1 : color2;
      context.fillRect(x * scale, y * scale, scale, scale);
    }
  }
}

export function runAnimation(frameFunction) {
  let lastTime = null;
  function frame(newTime) {
    if (lastTime != null) {
      const timePassed = Math.min(100, newTime - lastTime) / 1000;
      if (frameFunction(timePassed) === false) return;
    }
    lastTime = newTime;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

export function getRandomNumber(min, max) {
  return Math.floor(min + (max - min) * Math.random());
}

export function getDirection(speed) {
  if (speed.x > 0) return "right";
  if (speed.x < 0) return "left";
  if (speed.y > 0) return "down";
  if (speed.y < 0) return "up";
}

export function getAxis(direction) {
  if (direction === "left" || direction === "right") return "horizontal";
  if (direction === "up" || direction === "down") return "vertical";

  throw new Error(
    "getAxis() expects one of four string values: 'down', 'up', 'left' or 'right'"
  );
}
