import Vec from "./Vec.js";

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
  if (!direction) return direction;

  if (direction === "left" || direction === "right") return "horizontal";
  if (direction === "up" || direction === "down") return "vertical";

  throw new Error(
    "getAxis() expects one of four string values: 'down', 'up', 'left' or 'right'"
  );
}

export function getOppositeDirection(direction) {
  switch (direction) {
    case "right": {
      return "left";
    }
    case "left": {
      return "right";
    }
    case "up": {
      return "down";
    }
    case "down": {
      return "up";
    }
  }
}

export function getNextSnakeSpeed(
  nextDirection,
  currentSpeed,
  snakeSpeedValue
) {
  const axis = getAxis(getDirection(currentSpeed));

  if (nextDirection === "right" && axis !== "horizontal") {
    return new Vec(snakeSpeedValue, 0);
  } else if (nextDirection === "left" && axis !== "horizontal") {
    return new Vec(-snakeSpeedValue, 0);
  } else if (nextDirection === "down" && axis !== "vertical") {
    return new Vec(0, snakeSpeedValue);
  } else if (nextDirection === "up" && axis !== "vertical") {
    return new Vec(0, -snakeSpeedValue);
  }

  return currentSpeed;
}

export function allValuesAreIn(array, ...values) {
  let are = true;
  values.forEach((v) => {
    if (array.indexOf(v) === -1) are = false;
  });

  return are;
}