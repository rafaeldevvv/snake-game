import Vec from "./Vec.js";
import {
  elt,
  getRandomNumber,
  overlap,
  getDirection,
  getAxis,
  getOppositeDirection,
  getNextSnakeSpeed,
} from "./utilities.js";
import {
  rotateCanvasBasedOnCurve,
  rotateCanvasBasedOnDirection,
  drawChessBackground,
} from "./canvas-utilities.js";

import scale from "./scale.js";

// runAnimation is here because I need to store the current animation frame id in a variable to cancel it when the user resets the game.
let currentAnimation = null;
function runAnimation(frameFunction) {
  let lastTime = null;
  function frame(newTime) {
    if (lastTime != null) {
      const timePassed = Math.min(100, newTime - lastTime) / 1000;
      if (frameFunction(timePassed) === false) return;
    }
    lastTime = newTime;
    currentAnimation = requestAnimationFrame(frame);
  }
  currentAnimation = requestAnimationFrame(frame);
}

const snakeSpeed = 14;
const spriteScale = 20;

// a loop
const backgroundSong = new Audio("./audio/background.mp3");
backgroundSong.onended = function () {
  backgroundSong.currentTime = 0;
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

    let isChangingDirection = this.isChangingDirection;

    const nextDirection = scheduledDirectionChanges[0];

    // if it is not changing direction, then we can happily steer the snake into a specific direction
    if (!isChangingDirection && nextDirection) {
      isChangingDirection = true;
      scheduledDirectionChanges.shift();

      newSpeed = getNextSnakeSpeed(nextDirection, newSpeed, snakeSpeed);
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
        currentHead.isCurve = true;

        // we need to change the opposite direction because this array represents the directions the curve points at
        currentHead.directions = [
          getOppositeDirection(lastDirection),
          newHead.direction,
        ];
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
      this.isChangingDirection
    );
  }
}

const eatingSoundEffect = new Audio();
eatingSoundEffect.src = "./audio/eating.mp3";

const maxFruitOsc = 0.2;

class Fruit {
  constructor(position, tileX, osc, oscDirection) {
    this.position = position;
    this.tileX = tileX;

    // oscillation
    this.osc = osc;
    this.oscDirection = oscDirection;
  }

  update(timeStep) {
    let osc = this.osc;

    if (this.oscDirection === "positive") {
      osc += timeStep * maxFruitOsc;
    } else {
      osc -= timeStep * maxFruitOsc;
    }

    let oscDirection = this.oscDirection;
    if (osc > maxFruitOsc) {
      oscDirection = "negative";
    } else if (osc < 0) {
      oscDirection = "positive";
    }

    return new Fruit(this.position, this.tileX, osc, oscDirection);
  }

  // it returns a new state when it collides with the snake's head, making the snake longer
  collide(state) {
    const snake = state.snake;
    const longerSnake = snake.grow();

    if (!state.muted) {
      eatingSoundEffect.currentTime = 0; // reset the audio if it is playing
      eatingSoundEffect.play();
    }

    return new State(
      longerSnake,
      null,
      state.score + (this.score || 1),
      state.status,
      state.boundaries,
      state.bestScore,
      state.muted
    );
  }
}

function getRandomFruit(limitX, limitY) {
  return new Fruit(
    {
      x: getRandomNumber(0, limitX),
      y: getRandomNumber(0, limitY),
    },
    getRandomNumber(0, 10),
    0
  );
}

class State {
  constructor(snake, fruit, score, status, boundaries, bestScore, muted) {
    this.snake = snake;
    this.fruit = fruit;
    this.score = score;
    this.status = status;
    this.boundaries = boundaries;
    this.bestScore = bestScore;
    this.muted = muted;
  }

  static start(boundaries, muted) {
    const firstTail = [
      {
        position: new Vec(1, boundaries.y / 2),
        direction: "right",
      },
      {
        position: new Vec(0, boundaries.y / 2),
        direction: "right",
      },
    ];

    // defines the first snake with an initial tail
    const firstSnake = new Snake(
      {
        position: new Vec(2, boundaries.y / 2),
        direction: "right",
      },
      firstTail,
      2,
      new Vec(snakeSpeed, 0),
      [...firstTail],
      false
    );

    return new State(
      firstSnake,
      getRandomFruit(boundaries.x, boundaries.y),
      0,
      "playing",
      boundaries,
      localStorage.getItem("best-score") || 0,
      muted
    );
  }

  update(timeStep, scheduledDirectionChanges) {
    // update snake
    const newSnake = this.snake.update(timeStep, scheduledDirectionChanges);

    // wall collision
    const snakeHeadX = newSnake.head.position.x;
    const snakeHeadY = newSnake.head.position.y;
    const limitX = this.boundaries.x;
    const limitY = this.boundaries.y;

    if (this.fruit) {
      this.fruit = this.fruit.update(timeStep);
    }

    let newState = new State(
      newSnake,
      this.fruit || getRandomFruit(this.boundaries.x, this.boundaries.y),
      this.score,
      this.status,
      this.boundaries,
      this.bestScore,
      this.muted
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
        this.boundaries,
        newState.bestScore,
        newState.muted
      );
    }

    // tail collision
    if (this.snake.tail.some((part) => overlap(part, newSnake.head))) {
      newState = new State(
        newSnake,
        newState.fruit,
        this.score,
        "lost",
        this.boundaries,
        newState.bestScore,
        newState.muted
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

const $ = (selector) => document.querySelector(selector);

class View {
  constructor(controller, state) {
    this.controller = controller;
    this.state = state;

    this.canvasWidth = state.boundaries.x;
    this.canvasHeight = state.boundaries.y;

    this.scoreDOM = $("#current-score");
    this.bestScoreDOM = $("#best-score");
    $("#restart-btn").onclick = controller.restartGame.bind(controller);
    this.muteButton = $("#mute-btn");
    this.muteButton.onclick = controller.muteOrUnmuteGame.bind(controller);

    const canvas = elt("canvas", {
      width: this.canvasWidth * scale,
      height: this.canvasHeight * scale,
    });
    this.canvasContext = canvas.getContext("2d");

    this.finalMessageContainer = elt("div");

    this.canvasContainer = elt(
      "div",
      { className: "canvas-container" },
      canvas,
      this.finalMessageContainer
    );

    $("#canvas-container").appendChild(this.canvasContainer);

    this.drawBackground();

    if (snakeSprite.complete) {
      this.snake = state.snake;
    } else {
      snakeSprite.onload = () => (this.snake = state.snake);
    }

    if (fruitsSprite.complete) {
      this.fruit = state.fruit;
    } else {
      fruitsSprite.onload = () => (this.fruit = state.fruit);
    }

    this.muted = state.muted;
    this.bestScore = state.bestScore;
    this.score = state.score;

    window.addEventListener("keydown", (e) => {
      if (e.key.indexOf("Arrow") !== -1) {
        controller.onArrowPress(e);
      }

      if (e.key == "Escape") {
        controller.onEscPress(e);
      }
    });
  }

  set score(newScore) {
    this.scoreDOM.textContent = "Score: " + newScore;
  }

  set bestScore(newBestScore) {
    this.bestScoreDOM.textContent = "Best Score: " + newBestScore;
  }

  set snake(snake) {
    this.drawSnakeHead(snake.head);
    this.drawSnakeTail(snake.tail);
  }

  set fruit(fruit) {
    if (fruit) {
      this.drawFruit(fruit);
    }
  }

  set muted(muted) {
    if (muted) {
      this.muteButton.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
    } else {
      this.muteButton.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
    }
  }

  showFinalMessage(status) {
    const message = status.toUpperCase();
    this.finalMessageContainer.appendChild(
      elt(
        "div",
        { className: "final-message-container" },
        elt("p", { className: "lost-text" }, message),
        elt("p", null, "Press the Reset button to play again")
      )
    );
  }

  restartGame(state) {
    this.finalMessageContainer.textContent = "";
    this.drawBackground();
    this.snake = state.snake;
    this.fruit = state.fruit;
    this.score = state.score;
  }

  drawBackground() {
    drawChessBackground(
      this.canvasContext,
      this.canvasWidth,
      this.canvasHeight,
      "#00ff00",
      "#00f000"
    );
  }

  drawFruit(fruit) {
    const { x, y } = fruit.position;

    const scaledOsc = fruit.osc * scale;

    this.canvasContext.drawImage(
      fruitsSprite,
      spriteScale * fruit.tileX,
      0,
      spriteScale,
      spriteScale,
      Math.floor(x) * scale - scaledOsc / 2,
      Math.floor(y) * scale - scaledOsc / 2,
      scale + scaledOsc,
      scale + scaledOsc
    );
  }

  drawSnakeHead(head) {
    let x = Math.floor(head.position.x) * scale,
      y = Math.floor(head.position.y) * scale;

    /* let direction;
    if (snake.isChangingDirection) {
      direction = snake.tail[0].direction;
    } else {
      direction = snake.head.direction;
    } */

    this.canvasContext.save();
    rotateCanvasBasedOnDirection(
      this.canvasContext,
      head.direction,
      x + 0.5 * scale,
      y + 0.5 * scale
    );
    this.canvasContext.drawImage(
      snakeSprite,
      0,
      0,
      spriteScale,
      spriteScale,
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

      // the centers are used to rotate the canvas correctly
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
          3 * spriteScale,
          0,
          spriteScale,
          spriteScale,
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
          spriteScale,
          0,
          spriteScale,
          spriteScale,
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
      2 * spriteScale,
      0,
      spriteScale,
      spriteScale,
      x,
      y,
      scale,
      scale
    );
    this.canvasContext.restore();
  }
}

const mapBoundaries = { x: 20, y: 20 };

const directions = ["down", "up", "left", "right"];

class Controller {
  init(initialState, view) {
    this.state = initialState;
    this.view = view;

    this.scheduledDirectionChanges = [];
    this.isGamePaused = false;
    this.isGameRunning = false;
  }

  restartGame() {
    this.state = State.start(mapBoundaries, this.state.muted);
    this.view.restartGame(this.state);
    this.scheduledDirectionChanges = [];
    this.isGameRunning = false;
    cancelAnimationFrame(currentAnimation);
  }

  muteOrUnmuteGame() {
    const nextBoolean = !this.state.muted;
    this.state.muted = nextBoolean;
    this.view.muted = nextBoolean;

    if (!nextBoolean) {
      backgroundSong.play();
    } else {
      backgroundSong.pause();
    }
  }

  syncView(state) {
    this.view.drawBackground();

    // continue to update the view appropriately
    if (state.fruit) this.view.fruit = state.fruit;
    if (state.snake !== this.state.snake) this.view.snake = state.snake;
    if (state.score !== this.state.score) this.view.score = state.score;

    this.state = state;
  }

  onArrowPress(e) {
    e.preventDefault();

    if (!this.isGameRunning) {
      this.isGameRunning = true;
      this.isGamePaused = false;
      runAnimation((timeStep) => this.runner(timeStep));
    }

    if (this.isGamePaused) return;

    const key = e.key;

    let arrowDirection;
    directions.forEach((d) => {
      const directionRegExp = new RegExp(d, "i");

      if (directionRegExp.test(key)) {
        arrowDirection = d;
      }
    });

    const arrowAxis = getAxis(arrowDirection);
    if (this.scheduledDirectionChanges.every((d) => getAxis(d) !== arrowAxis)) {
      this.scheduledDirectionChanges.push(arrowDirection);
    }
  }

  onEscPress(e) {
    e.preventDefault();

    this.isGamePaused = !this.isGamePaused;
  }

  runner(timeStep) {
    if (this.isGamePaused) return true;

    const nextState = this.state.update(
      timeStep,
      this.scheduledDirectionChanges
    );

    if (nextState.status === "playing") {
      this.syncView(nextState);
      return true;
    } else {
      this.view.showFinalMessage(nextState.status);
      this.saveBestScore(nextState.score);
      return false;
    }
  }

  saveBestScore(newBestScore) {
    const savedBestScore = this.state.bestScore;

    if (savedBestScore < newBestScore) {
      localStorage.setItem("best-score", newBestScore);
      this.view.bestScore = newBestScore;
    }
  }
}

const state = State.start(mapBoundaries, true);
const controller = new Controller();
const view = new View(controller, state);

controller.init(state, view);
