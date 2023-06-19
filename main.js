const scale = 20;

function elt(type, attrs, ...children) {
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

const snakeSpeed = 10;

class Snake {
  constructor(head, tail, tailLength, speed, previousPositions) {
    this.head = head;
    this.tail = tail; // the closer it is to the beginning of the array, the closer it is to the head
    this.speed = speed;
    this.previousPositions = previousPositions;
    this.tailLength = tailLength;
  }

  update(time, keys) {
    // update direction based on keys
    let speed = this.speed;
    if (keys.ArrowDown && this.speed.y === 0) {
      speed = new Vec(0, snakeSpeed);
    }
    if (keys.ArrowUp && this.speed.y === 0) {
      speed = new Vec(0, -snakeSpeed);
    }
    if (keys.ArrowLeft && this.speed.x === 0) {
      speed = new Vec(-snakeSpeed, 0);
    }
    if (keys.ArrowRight && this.speed.x === 0) {
      speed = new Vec(snakeSpeed, 0);
    }

    // update head position based on direction
    let previousPositions = this.previousPositions;
    const newHeadPosition = this.head.position.plus(speed.times(time));

    if (
      Math.floor(newHeadPosition.x) !== Math.floor(this.head.position.x) ||
      Math.floor(newHeadPosition.y) !== Math.floor(this.head.position.y)
    ) {
      previousPositions.unshift(this.head.position);
    }

    const newHead = {
      position: newHeadPosition,
    };

    previousPositions = previousPositions.filter((_, i) => i < this.tailLength);

    // update the tail positions based on what the previous ones were
    const newTail = this.previousPositions.map((p) => ({
      position: p,
    }));

    // return new Snake
    return new Snake(
      newHead,
      newTail,
      this.tailLength,
      speed,
      previousPositions
    );
  }

  increase() {
    const newTailLength = this.tailLength + 1;
    const newTail = this.previousPositions
      .map((p) => ({
        position: p,
      }))
      .filter((_, i) => i < newTailLength);

    return new Snake(
      this.head,
      newTail,
      newTailLength,
      this.speed,
      this.previousPositions
    );
  }
}

class Food {
  constructor(x, y, color) {
    this.position = { x, y };
    this.color = color;
  }

  collide(state) {
    const snake = state.snake;
    const longerSnake = snake.increase();

    return new State(
      longerSnake,
      state.food.filter((f) => f !== this),
      state.score + (this.score || 1),
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
      2,
      new Vec(snakeSpeed, 0),
      []
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

    let newState = new State(
      newSnake,
      this.food,
      this.score,
      this.status,
      this.boundaries
    );

    if (snakeX >= limitX || snakeY >= limitY || snakeX < 0 || snakeY < 0) {
      newState = new State(
        newSnake,
        this.food,
        this.score,
        "lost",
        this.boundaries
      );
    }

    // snake collision
    if (this.snake.tail.some((part) => overlap(part, newSnake.head))) {
      newState = new State(
        newSnake,
        this.food,
        this.score,
        "lost",
        this.boundaries
      );
    }

    // fruit collision
    for (const piece of this.food) {
      if (overlap(piece, newSnake.head)) {
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

    // draw background
    drawChessBackground(cx, this.width, this.height, "#00ff00", "#00f000");

    // draw snake

    // draw food
    for (const piece of state.food) {
      const { x, y } = piece.position;
      cx.fillStyle = piece.color;

      cx.beginPath();
      cx.arc((Math.floor(x) + 0.5) * scale, (Math.floor(y) + 0.5) * scale, scale / 2.5, 0, 7)
      cx.fill();
      cx.closePath();
    }

    // show score
    cx.fillStyle = "black";
    cx.fillText("Score: " + state.score, scale, scale);

    const snakeParts = [state.snake.head, ...state.snake.tail];
    for (const part of snakeParts) {
      const { x, y } = part.position;
      cx.fillRect(Math.floor(x) * scale, Math.floor(y) * scale, scale, scale);
    }
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

const foodColors = ["red", "yellow", "orange", "blue", "lightblue", "purple", "tomato", "navy", "teal"];

function getRandomNumber(min, max) {
  return min + (max - min) * Math.random();
}

function getRandomFood(limitX, limitY) {
  return new Food(
    Math.floor(getRandomNumber(0, limitX)),
    Math.floor(getRandomNumber(0, limitY)),
    foodColors[Math.floor(getRandomNumber(0, foodColors.length))]
  );
}

function runGame() {
  let state = State.start({ x: 20, y: 20 });
  const display = new CanvasDisplay(20, 20);
  document.body.appendChild(display.dom);

  const arrowKeys = trackKeys([
    "ArrowDown",
    "ArrowUp",
    "ArrowLeft",
    "ArrowRight",
  ]);

  runAnimation((timeStep) => {
    state = state.update(timeStep, arrowKeys);

    if (state.food.length < 1) {
      state.food.push(getRandomFood(20, 20));
    }

    if (state.status === "playing") {
      display.syncState(state);
      return true;
    } else {
      arrowKeys.unregister();
      console.log("lost");
      return false;
    }
  });
}

runGame();
