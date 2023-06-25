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

const snakeSpeed = 15;

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
    let speed = this.speed;

    const nextDirection = scheduledDirectionChanges.shift();
    const currentAxis = getAxis(this.head.direction);
    let isChangingDirection = this.isChangingDirection;

    // if it is not changing direction, then we can happily steer the snake into a specific direction
    if (!isChangingDirection) {
      isChangingDirection = true;

      if (nextDirection === "right" && currentAxis !== "horizontal") {
        speed = new Vec(snakeSpeed, 0);
      } else if (nextDirection === "left" && currentAxis !== "horizontal") {
        speed = new Vec(-snakeSpeed, 0);
      } else if (nextDirection === "down" && currentAxis !== "vertical") {
        speed = new Vec(0, snakeSpeed);
      } else if (nextDirection === "up" && currentAxis !== "vertical") {
        speed = new Vec(0, -snakeSpeed);
      }
    } else if (nextDirection) {
      // if it is changing direction we cannot stop this change,
      // so we give the nextDirection back to the scheduledDirectionChanges array.
      scheduledDirectionChanges.unshift(nextDirection);
    }

    const newHeadPosition = this.head.position.plus(speed.times(timeStep));

    // add 0.5 so that the snake won't go quicker if the speed is negative
    const newHead = {
      position: new Vec(
        currentAxis === 'vertical'
          ? Math.floor(newHeadPosition.x) + 0.5
          : newHeadPosition.x,
        currentAxis === 'horizontal'
          ? Math.floor(newHeadPosition.y) + 0.5
          : newHeadPosition.y
      ),
      direction: getDirection(speed),
    };

    let previousHeads = this.previousHeads;

    if (
      ~~newHeadPosition.x !== ~~this.head.position.x ||
      ~~newHeadPosition.y !== ~~this.head.position.y
    ) {
      // it only adds positions that are different in either axis to avoid overlapping
      previousHeads.unshift(this.head);

      // if any axis position is different from what it was before, then the direction changed successfully
      isChangingDirection = false;
    }

    // it cuts off the unnecessary saved positions based on the current tail length
    previousHeads = previousHeads.filter((_, i) => i < this.tailLength);

    const newTail = previousHeads;

    return new Snake(
      newHead,
      newTail,
      this.tailLength,
      speed,
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
      this.isChangingDirection
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
      []
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

    // draw fruit
    if (state.fruit) {
      const fruit = state.fruit;
      const { x, y } = fruit.position;

      cx.drawImage(
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

    // show score
    cx.fillStyle = "black";
    cx.font = "bold 18px Arial";
    cx.fillText("Score: " + state.score, scale, scale * 1.5);

    // draw snake
    const snakeParts = [state.snake.head, ...state.snake.tail];
    for (const part of snakeParts) {
      const { x, y } = part.position;
      cx.fillRect(Math.floor(x) * scale, Math.floor(y) * scale, scale, scale);
    }
  }
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
  const display = new CanvasDisplay(mapBoundaries.x, mapBoundaries.y);
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
