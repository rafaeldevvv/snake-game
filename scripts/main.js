import Vec from "./Vec.js";
import {
  elt,
  getRandomNumber,
  runAnimation,
  overlap,
  drawChessBackground,
  getDirection,
  getAxis,
} from "./utilities.js";
import scale from "./scale.js";

const snakeSpeed = 14;

const backgroundSong = new Audio("./audio/background.mp3");
backgroundSong.onended = function () {
  backgroundSong.play();
};

class Snake {
  constructor(
    head,
    tail,
    tailLength,
    speed,
    previousHeads,
    isChangingDirection
  ) {
    this.head = head;
    this.tail = tail; // the closer it is to the beginning of the array, the closer it is to the head
    this.speed = speed;
    this.previousHeads = previousHeads;
    this.tailLength = tailLength;
    this.isChangingDirection = isChangingDirection;
  }

  update(timeStep, scheduledDirectionChanges) {
    let newSpeed = this.speed;

    const nextDirection = scheduledDirectionChanges[0];
    let currentAxis = getAxis(getDirection(newSpeed));
    let isChangingDirection = this.isChangingDirection;

    // if it is not changing direction, then we can happily steer the snake into a specific direction
    if (!isChangingDirection && nextDirection) {
      isChangingDirection = true;
      scheduledDirectionChanges.shift();

      if (nextDirection === "right" && currentAxis !== "horizontal") {
        newSpeed = new Vec(snakeSpeed, 0);
      } else if (nextDirection === "left" && currentAxis !== "horizontal") {
        newSpeed = new Vec(-snakeSpeed, 0);
      } else if (nextDirection === "down" && currentAxis !== "vertical") {
        newSpeed = new Vec(0, snakeSpeed);
      } else if (nextDirection === "up" && currentAxis !== "vertical") {
        newSpeed = new Vec(0, -snakeSpeed);
      }
    }

    const newHeadPosition = this.head.position.plus(newSpeed.times(timeStep));

    const goingToAxis = getAxis(getDirection(newSpeed));

    // add 0.5 so that the snake won't go quicker if the newSpeed is negative
    const newHead = {
      position: new Vec(
        goingToAxis === "vertical"
          ? Math.floor(newHeadPosition.x) + 0.5
          : newHeadPosition.x,
        goingToAxis === "horizontal"
          ? Math.floor(newHeadPosition.y) + 0.5
          : newHeadPosition.y
      ),
      direction: getDirection(newSpeed),
    };

    let previousHeads = this.previousHeads;

    if (
      ~~newHeadPosition.x !== ~~this.head.position.x ||
      ~~newHeadPosition.y !== ~~this.head.position.y
    ) {
      // it only adds positions that are different in either axis to avoid overlapping
      const currentHead = { ...this.head };

      const lastDirection = this.tail[0]?.direction || this.head.direction;
      const nextAxis = getAxis(newHead.direction);
      const currentAxis = getAxis(lastDirection);

      // if any axis position is different from what it was before, then the direction changed successfully
      if (currentAxis !== nextAxis) {
        let otherDirection;

        switch (lastDirection) {
          case "right": {
            otherDirection = "left";
            break;
          }
          case "left": {
            otherDirection = "right";
            break;
          }
          case "up": {
            otherDirection = "down";
            break;
          }
          case "down": {
            otherDirection = "up";
            break;
          }
        }

        currentHead.isCurve = true;
        currentHead.directions = [otherDirection, newHead.direction];
      }

      previousHeads.unshift(currentHead);
      isChangingDirection = false;
    }

    // it cuts off the unnecessary saved positions based on the current tail length;
    previousHeads = previousHeads.filter((_, i) => i < this.tailLength);

    const newTail = [...previousHeads];

    return new Snake(
      newHead,
      newTail,
      this.tailLength,
      newSpeed,
      previousHeads,
      isChangingDirection
    );
  }

  grow() {
    // it is not necessary to update the tail here because it will happen in the update method
    const newTailLength = this.tailLength + 1;

    return new Snake(
      this.head,
      this.tail,
      newTailLength,
      this.speed,
      this.previousHeads,
      this.changingTo
    );
  }
}

const eatingSoundEffect = new Audio();
eatingSoundEffect.src = "./audio/eating.mp3";

class Fruit {
  constructor(x, y, tileX) {
    this.position = { x, y };
    this.tileX = tileX;
  }

  // it returns a new state when it collides with the snake's head, making the snake longer
  collide(state) {
    const snake = state.snake;
    const longerSnake = snake.grow();
    eatingSoundEffect.currentTime = 0; // reset the audio if it is playing
    eatingSoundEffect.play();

    return new State(
      longerSnake,
      null,
      state.score + (this.score || 1),
      state.status,
      state.boundaries
    );
  }
}

class State {
  constructor(snake, fruit, score, status, boundaries) {
    this.snake = snake;
    this.fruit = fruit;
    this.score = score;
    this.status = status;
    this.boundaries = boundaries;
  }

  static start(boundaries) {
    const firstSnake = new Snake(
      {
        position: new Vec(0, boundaries.y / 2),
        direction: "right",
      },
      [],
      2,
      new Vec(snakeSpeed, 0),
      [],
      null
    );

    return new State(firstSnake, null, 0, "playing", boundaries);
  }

  update(timeStep, scheduledDirectionChanges) {
    // update snake
    const newSnake = this.snake.update(timeStep, scheduledDirectionChanges);

    // wall collision
    const snakeHeadX = newSnake.head.position.x;
    const snakeHeadY = newSnake.head.position.y;
    const limitX = this.boundaries.x;
    const limitY = this.boundaries.y;

    let newState = new State(
      newSnake,
      this.fruit || getRandomFruit(this.boundaries.x, this.boundaries.y),
      this.score,
      this.status,
      this.boundaries
    );

    if (
      snakeHeadX >= limitX ||
      snakeHeadY >= limitY ||
      snakeHeadX < 0 ||
      snakeHeadY < 0
    ) {
      newState = new State(
        newSnake,
        newState.fruit,
        this.score,
        "lost",
        this.boundaries
      );
    }

    // tail collision
    if (this.snake.tail.some((part) => overlap(part, newSnake.head))) {
      newState = new State(
        newSnake,
        newState.fruit,
        this.score,
        "lost",
        this.boundaries
      );
    }

    // fruit collision
    if (this.fruit !== null && overlap(this.fruit, newSnake.head)) {
      newState = this.fruit.collide(newState);
    }

    // return next state
    return newState;
  }
}

const fruitsSprite = elt("img", { src: "./images/fruits-sprite.png" });
const snakeSprite = elt("img", { src: "./images/snake-sprite.png" });

class View {
  constructor(width, height) {
    this.scoreDOM = elt("span", { className: "score" });
    this.bestScoreDOM = elt("span", { className: "best-score" });
    this.resetButton = elt("button", { className: "reset-btn btn" });
    this.muteButton = elt("button", { className: "mute-btn btn" });

    const canvas = elt("canvas", {
      width: width * scale,
      height: height * scale,
    });

    this.dom = elt(
      "div",
      { id: "game-container" },
      elt("div", { className: "score-container" }, this.scoreDOM, this.bestScoreDOM),
      canvas,
      elt("div", { className: "buttons" }, this.resetButton, this.muteButton)
    );

    this.width = width;
    this.height = height;
    this.canvasContext = canvas.getContext("2d");
  }

  syncState(state) {
    // draw background
    this.drawBackground();

    // draw fruit
    if (state.fruit) {
      this.drawFruit(state.fruit);
    }

    // show score
    this.canvasContext.fillStyle = "black";
    this.canvasContext.font = "bold 18px Arial";
    this.canvasContext.fillText("Score: " + state.score, scale, scale * 1.5);

    // draw snake
    const { tail } = state.snake;
    this.drawSnakeHead(state.snake);

    this.drawSnakeTail(tail);
  }

  drawBackground() {
    drawChessBackground(
      this.canvasContext,
      this.width,
      this.height,
      "#00ff00",
      "#00f000"
    );
  }

  drawFruit(fruit) {
    const { x, y } = fruit.position;

    this.canvasContext.drawImage(
      fruitsSprite,
      scale * fruit.tileX,
      0,
      scale,
      scale,
      Math.floor(x) * scale,
      Math.floor(y) * scale,
      scale,
      scale
    );
  }

  drawSnakeHead(snake) {
    const head = snake.head;
    let x = Math.floor(head.position.x) * scale,
      y = Math.floor(head.position.y) * scale;

    let direction;
    if (snake.isChangingDirection) {
      direction = snake.tail[0];
    } else {
      direction = snake.head.direction;
    }

    this.canvasContext.save();
    rotateCanvasBasedOnDirection(
      this.canvasContext,
      direction,
      x + 0.5 * scale,
      y + 0.5 * scale
    );
    this.canvasContext.drawImage(
      snakeSprite,
      0,
      0,
      scale,
      scale,
      x,
      y,
      scale,
      scale
    );
    this.canvasContext.restore();
  }

  drawSnakeTail(tail) {
    if (tail.length === 0) return;

    for (let i = 0; i < tail.length - 1; i++) {
      const part = tail[i];

      const centerX = (Math.floor(part.position.x) + 0.5) * scale,
        centerY = (Math.floor(part.position.y) + 0.5) * scale;
      const x = Math.floor(part.position.x) * scale,
        y = Math.floor(part.position.y) * scale;

      if (part.isCurve) {
        this.canvasContext.save();
        rotateCanvasBasedOnCurve(
          this.canvasContext,
          part.directions,
          centerX,
          centerY
        );
        this.canvasContext.drawImage(
          snakeSprite,
          3 * scale,
          0,
          scale,
          scale,
          x,
          y,
          scale,
          scale
        );
        this.canvasContext.restore();
      } else {
        const direction = part.direction;

        this.canvasContext.save();
        rotateCanvasBasedOnDirection(
          this.canvasContext,
          direction,
          centerX,
          centerY
        );
        this.canvasContext.drawImage(
          snakeSprite,
          scale,
          0,
          scale,
          scale,
          x,
          y,
          scale,
          scale
        );
        this.canvasContext.restore();
      }
    }

    const finalPart = tail[tail.length - 1];

    let { x, y } = finalPart.position;
    (x = Math.floor(x) * scale), (y = Math.floor(y) * scale);

    this.canvasContext.save();
    rotateCanvasBasedOnDirection(
      this.canvasContext,
      finalPart.direction,
      x + 0.5 * scale,
      y + 0.5 * scale
    );
    this.canvasContext.drawImage(
      snakeSprite,
      2 * scale,
      0,
      scale,
      scale,
      x,
      y,
      scale,
      scale
    );
    this.canvasContext.restore();
  }
}

function rotateCanvasBasedOnCurve(context, directions, aroundX, aroundY) {
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

function allValuesAreIn(array, ...values) {
  let are = true;
  values.forEach((v) => {
    if (array.indexOf(v) === -1) are = false;
  });

  return are;
}

function rotateCanvasBasedOnDirection(context, direction, aroundX, aroundY) {
  let degree = 0;
  if (direction === "up") degree = 360;
  else if (direction === "down") degree = 180;
  else if (direction === "left") degree = 270;
  else if (direction === "right") degree = 90;
  else degree = 0;

  rotateCanvas(context, degree, aroundX, aroundY);
}

function rotateCanvas(context, degree, aroundX, aroundY) {
  context.translate(aroundX, aroundY);
  context.rotate((degree * Math.PI) / 180);
  context.translate(-aroundX, -aroundY);
}

function getRandomFruit(limitX, limitY) {
  return new Fruit(
    getRandomNumber(0, limitX),
    getRandomNumber(0, limitY),
    getRandomNumber(0, 10)
  );
}

const mapBoundaries = { x: 20, y: 20 };

function runGame() {
  let state = State.start(mapBoundaries);
  const display = new View(mapBoundaries.x, mapBoundaries.y);
  document.body.appendChild(display.dom);

  // it is used to schedule changes in the snake's direction
  const scheduledDirectionChanges = [];

  window.addEventListener("keydown", (e) => {
    if (
      e.key === "ArrowDown" &&
      scheduledDirectionChanges.every((d) => getAxis(d) !== "vertical")
    ) {
      scheduledDirectionChanges.push("down");
    } else if (
      e.key === "ArrowUp" &&
      scheduledDirectionChanges.every((d) => getAxis(d) !== "vertical")
    ) {
      scheduledDirectionChanges.push("up");
    } else if (
      e.key === "ArrowLeft" &&
      scheduledDirectionChanges.every((d) => getAxis(d) !== "horizontal")
    ) {
      scheduledDirectionChanges.push("left");
    } else if (
      e.key === "ArrowRight" &&
      scheduledDirectionChanges.every((d) => getAxis(d) !== "horizontal")
    ) {
      scheduledDirectionChanges.push("right");
    }
  });

  runAnimation((timeStep) => {
    state = state.update(timeStep, scheduledDirectionChanges);

    if (state.status === "playing") {
      display.syncState(state);
      return true;
    } else {
      console.log("lost");
      return false;
    }
  });
}

runGame();
