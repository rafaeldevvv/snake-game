const scale = 10;

function elt(type, attrs, children) {
  const domElement = document.querySelector(type);
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

class Vec {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  plus(other) {
    return new Vec(this.x + other.x, this.y + other.y);
  }

  times(factor) {
    return new Vec(this.x * factor, this.y * factor);
  }
}

class Snake {
  constructor(head, tail, speed) {
    this.head = head;
    this.tail = tail; // the closer it is to the beginning of the array, the closer it is to the head
    this.speed = speed;
  }

  update(time, keys) {
    // update direction based on keys
    let newSpeed = this.speed;
    if (keys.ArrowDown && this.head.direction !== "down") {
      newSpeed = new Vec(0, 2);
    }
    if (keys.ArrowUp && this.head.direction !== "up") {
      newSpeed = new Vec(0, -2);
    }
    if (keys.ArrowLeft && this.head.direction !== "left") {
      newSpeed = new Vec(-2, 0);
    }
    if (keys.ArrowRight && this.head.direction !== "right") {
      newSpeed = new Vec(2, 0);
    }

    // update head position based on direction
    let newHeadPosition = this.head.position.plus(newSpeed.times(time));
    let previousHeadPosition = this.head.position;

    // update the tail positions based on what the previous ones were
    const newTail = [previousHeadPosition, ...this.tail];
    newTail.pop();

    // return new Snake
    return new Snake(
      {
        position: newHeadPosition,
      },
      newTail,
      newSpeed
    );
  }

  increase() {
    const lastPart = this.tail[this.tail.length - 1];

    const newTail = this.tail.slice();
    newTail.push({
      position: {
        x: lastPart.position.x,
        y: lastPart.position.y,
      },
    });

    return new Snake(this.head, newTail, this.speed);
  }
}

class FoodGenerator {
  constructor() {
    this.foodTypes = [];
  }

  register(piece) {
    this.foodTypes.push(piece);
  }

  generateFood() {
    const numberOfPieces = this.foodTypes.length;
    if (numberOfPieces === 0) {
      throw new Error("No food registered");
    }

    return { ...this.foodTypes[Math.floor(Math.random() * numberOfPieces)] };
  }
}

class FoodType {
  constructor(type, score, imagePath) {
    this.type = type;
    this.score = score;
    this.imagePath = imagePath;
  }

  collide(state) {
    const snake = state.snake;
    const longerSnake = snake.increase();

    return new State(
      longerSnake,
      state.food.filter((f) => f !== this),
      state.score + this.score,
      state.status,
      state.boundaries
    );
  }
}

class State {
  constructor(snake, food, score, status, boundaries) {
    this.snake = snake;
    this.food = food;
    this.score = score;
    this.status = status;
    this.boundaries = boundaries;
  }

  static start(boundaries) {
    const firstSnake = new Snake(
      {
        position: new Vec(0, 0),
      },
      [],
      new Vec(2, 0)
    );

    return new State(firstSnake, [], 0, "playing", boundaries);
  }

  update(time, keys) {
    // update snake
    const newSnake = this.snake.update(time, keys);

    // wall collision
    const snakeX = newSnake.head.position.x;
    const snakeY = newSnake.head.position.y;
    const limitX = this.boundaries.x;
    const limitY = this.boundaries.y;

    if (snakeX >= limitX || snakeY >= limitY || snakeX < 0 || snakeY < 0) {
      return new State(
        newSnake,
        this.food,
        this.score,
        "lost",
        this.boundaries
      );
    }

    // snake collision
    if (this.snake.tail.some((part) => overlap(part, newSnake.head))) {
      return new State(
        newSnake,
        this.food,
        this.score,
        "lost",
        this.boundaries
      );
    }

    // fruit collision
    let newState = this;
    for (const piece of this.food) {
      if (overlap(piece, newSnake)) {
        newState = piece.collide(newState);
      }
    }

    // return next state
    return newState;
  }
}

function overlap(actor1, actor2) {
  return (
    Math.floor(actor1.position.x) === Math.floor(actor2.position.x) &&
    Math.floor(actor1.position.y) === Math.floor(actor2.position.y)
  );
}

function drawChessBackground(context, width, height, color1, color2) {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      context.fillStyle = (x + y) % 2 === 0 ? color1 : color2;
      context.fillRect(x * scale, y * scale, scale, scale);
    }
  }
}

class CanvasDisplay {
  constructor(width, height) {
    this.dom = elt("canvas", {
      width: width * scale,
      height: height * scale,
    });

    this.width = width;
    this.height = height;
  }

  syncState(state) {
    const cx = this.dom.getContext("2d");

    cx.clearRect(0, 0, this.width * scale, this.height * scale);

    // draw background
    drawChessBackground(cx, this.width, this.height, "00ff00", "00f000");

    // draw snake
    const snakeParts = [state.snake.head, ...state.snake.tail];
    cx.fillStyle = "black";
    for (const part of snakeParts) {
      const { x, y } = part.position;
      cx.fillRect(x * scale, y * scale, scale, scale);
    }

    // draw food
    for (const piece of state.food) {
      const { x, y } = piece.position;
      cx.fillStyle = piece.color;
      cx.fillRect(x * scale, y * scale, scale, scale);
    }

    // show score
    cx.fillText("Score: " + state.score, scale, scale);
  }
}

function trackKeys(keyNames) {
  const down = {};
  function track(event) {
    if (keyNames.includes(event.key)) {
      down[event.key] = event.type === "keydown";
    }
  }
  window.addEventListener("keydown", track);
  window.addEventListener("keyup", track);

  down.unregister = function () {
    window.removeEventListener("keydown", track);
    window.removeEventListener("keyup", track);
  };

  return down;
}

function runAnimation(frameFunction) {
  let lastTime = performance.now();
  function frame(newTime) {
    const timePassed = Math.min(100, newTime - lastTime) / 1000;
    lastTime = newTime;
    if (frameFunction(timePassed) === true) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

const colors = ["red", "yellow", "orange"];

function getRandomFood(limitX, limitY) {
  return {
    position: {
      x: Math.floor(Math.random() * limitX),
      y: Math.floor(Math.random() * limitY),
    },
    color: colors[Math.floor(Math.random() * colors.length)],
  };
}

function runGame() {
  let state = State.start({ x: 30, y: 20 });
  const display = new CanvasDisplay(30, 20);
  document.body.appendChild(display.dom);

  const arrowKeys = trackKeys([
    "ArrowDown",
    "ArrowUp",
    "ArrowLeft",
    "ArrowRight",
  ]);

  runAnimation((timeStep) => {
    state = state.update(timeStep, arrowKeys);

    if (state.food.length < 3) {
      state.food.push(getRandomFood(30, 20));
    }

    if (state.status === "playing") {
      display.syncState(state);
      return true;
    } else {
      arrowKeys.unregister();
      return false;
    }
  });
}
