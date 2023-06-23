import Vec from "./Vec.js";
import {
  elt,
  getRandomItem,
  getRandomNumber,
  createImageElement,
  runAnimation,
  trackKeys,
  overlap,
  drawChessBackground,
  getDirection,
} from "./utilities.js";
import scale from "./scale.js";

const snakeSpeed = 10;

const backgroundSong = new Audio("./audio/background.mp3");
backgroundSong.onended = function () {
  backgroundSong.play();
};

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
      previousPositions.unshift(this.head);
    }

    const newDirection = getDirection(speed);

    const newHead = {
      position: new Vec(
        newDirection === "down" || newDirection === "up"
          ? Math.floor(newHeadPosition.x)
          : newHeadPosition.x,
        newDirection === "right" || newDirection === "left"
          ? Math.floor(newHeadPosition.y)
          : newHeadPosition.y
      ),
      direction: newDirection,
    };

    previousPositions = previousPositions.filter((_, i) => i < this.tailLength);

    // update the tail positions based on what the previous ones were
    const newTail = this.previousPositions;

    // return new Snake
    return new Snake(
      newHead,
      newTail,
      this.tailLength,
      speed,
      previousPositions
    );
  }

  grow() {
    const newTailLength = this.tailLength + 1;
    const newTail = this.previousPositions.map((p) => ({
      position: p,
    }));

    return new Snake(
      this.head,
      newTail,
      newTailLength,
      this.speed,
      this.previousPositions
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
        position: new Vec(0, 0),
        direction: "right",
      },
      [],
      2,
      new Vec(snakeSpeed, 0),
      []
    );

    return new State(firstSnake, null, 0, "playing", boundaries);
  }

  update(time, keys) {
    // update snake
    const newSnake = this.snake.update(time, keys);

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

    // snake collision
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
    cx.fillText("Score: " + state.score, scale, scale);

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
    Math.floor(getRandomNumber(0, 10))
  );
}

const mapBoundaries = { x: 20, y: 20 };

function runGame() {
  let state = State.start(mapBoundaries);
  const display = new CanvasDisplay(mapBoundaries.x, mapBoundaries.y);
  document.body.appendChild(display.dom);

  const arrowKeys = trackKeys([
    "ArrowDown",
    "ArrowUp",
    "ArrowLeft",
    "ArrowRight",
  ]);

  backgroundSong.oncanplaythrough = function () {
    // backgroundSong.play();
  };

  runAnimation((timeStep) => {
    state = state.update(timeStep, arrowKeys);

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
