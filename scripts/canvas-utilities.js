import { allValuesAreIn } from "./utilities.js";
import scale from "./scale.js";

export function rotateCanvasBasedOnDirection(
  context,
  direction,
  aroundX,
  aroundY
) {
  let degree = 0;
  if (direction === "up") degree = 360;
  else if (direction === "down") degree = 180;
  else if (direction === "left") degree = 270;
  else if (direction === "right") degree = 90;
  else degree = 0;

  rotateCanvas(context, degree, aroundX, aroundY);
}

export function rotateCanvas(context, degree, aroundX, aroundY) {
  context.translate(aroundX, aroundY);
  context.rotate((degree / 360) * Math.PI * 2);
  context.translate(-aroundX, -aroundY);
}

// it rotates the canvas based on what directions the curve points at
export function rotateCanvasBasedOnCurve(
  context,
  directions,
  aroundX,
  aroundY
) {
  let degree;
  if (allValuesAreIn(directions, "up", "right")) {
    degree = 0;
  } else if (allValuesAreIn(directions, "right", "down")) {
    degree = 90;
  } else if (allValuesAreIn(directions, "down", "left")) {
    degree = 180;
  } else if (allValuesAreIn(directions, "up", "left")) {
    degree = 270;
  }

  rotateCanvas(context, degree, aroundX, aroundY);
}

export function drawChessBackground(context, width, height, color1, color2) {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      context.fillStyle = (x + y) % 2 === 0 ? color1 : color2;
      context.fillRect(x * scale, y * scale, scale, scale);
    }
  }
}