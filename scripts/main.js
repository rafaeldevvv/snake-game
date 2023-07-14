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

const mapBoundaries = { x: 20, y: 20 };
const snakeSpeed = 13;
const spriteScale = 20;

let scale = 20;

// the innerWidth is divided by fourteen to give space to side margin or padding
if (mapBoundaries.x * scale > innerWidth) {
  scale = (innerWidth - 30) / mapBoundaries.x; // 30 because the inline padding is also 30
}

// runAnimation is here because I need to store the current animation frame
// id in a variable to cancel it when the user resets the game.
// otherwise there'll be another running animation breaking the restarted game
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
      // if the square in which the head of the snake is different, then the direction was changed successfully
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

const eatingSoundEffect = new Audio("./audio/eating.mp3");
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

    if (!state.isGameMuted) {
      eatingSoundEffect.currentTime = 0;
      eatingSoundEffect.play();
    }

    return new State(
      longerSnake,
      null,
      state.score + 1,
      state.status,
      state.boundaries,
      state.bestScore,
      state.isGameMuted
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
  constructor(snake, fruit, score, status, boundaries, bestScore, isGameMuted) {
    this.snake = snake;
    this.fruit = fruit;
    this.score = score;
    this.status = status;
    this.boundaries = boundaries;
    this.bestScore = bestScore;
    this.isGameMuted = isGameMuted;
  }

  static start(boundaries, isGameMuted) {
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
      isGameMuted
    );
  }

  update(timeStep, scheduledDirectionChanges) {
    // update snake
    const newSnake = this.snake.update(timeStep, scheduledDirectionChanges);

    // making the next if statement easier to read
    const snakeHeadX = newSnake.head.position.x;
    const snakeHeadY = newSnake.head.position.y;
    const limitX = this.boundaries.x;
    const limitY = this.boundaries.y;

    let fruit = this.fruit;

    if (fruit) {
      fruit = this.fruit.update(timeStep);
    } else {
      fruit = getRandomFruit(this.boundaries.x, this.boundaries.y);
    }

    let newState = new State(
      newSnake,
      fruit,
      this.score,
      this.status,
      this.boundaries,
      this.bestScore,
      this.isGameMuted
    );

    // wall collision or tail collision
    if (
      snakeHeadX >= limitX ||
      snakeHeadY >= limitY ||
      snakeHeadX < 0 ||
      snakeHeadY < 0 ||
      newSnake.tail.some((part) => overlap(part, newSnake.head))
    ) {
      newState.status = "lost";
    }

    // fruit collision
    if (!!fruit && overlap(fruit, newSnake.head) && newState.status !== 'lost') {
      newState = fruit.collide(newState);
    }

    // return next state
    return newState;
  }
}

const fruitsSprite = elt("img", { src: "./images/fruits-sprite.png" });
const snakeSprite = elt("img", { src: "./images/snake-sprite.png" });

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

class View {
  constructor(state, controller, shortcuts) {
    this.controller = controller;
    this.state = state;
    this.shortcuts = shortcuts;

    this.canvasWidth = state.boundaries.x;
    this.canvasHeight = state.boundaries.y;

    this.#createCanvas();
    this.#getReferences();
    this.#registerEventHandlers();
    this.#init();
  }

  syncState(state) {
    // continue to update the view appropriately
    this.#drawBackground();
    if (state.fruit) this.#drawFruit(state.fruit);
    this.#drawSnake(state.snake);

    if (state.score !== this.state.score) {
      this.setScore(state.score);
    }
    if (state.score > state.bestScore) {
      this.setBestScore(state.score);
    }

    this.state = state;
  }

  setScore(newScore) {
    this.scoreDOM.textContent = "Score: " + newScore;
  }

  setBestScore(newBestScore) {
    this.bestScoreDOM.textContent = "Best Score: " + newBestScore;
  }

  syncMuted(muted) {
    const m = `<span class="keyboard-devices-inline">(M)</span>`;
    const volumeIcon = muted ? "xmark" : "high";

    this.muteButton.innerHTML = `<i class="fa-solid fa-volume-${volumeIcon}"></i> ${m}`;
  }

  syncPaused(paused) {
    const p = '<span class="keyboard-devices-inline">(P)</span>';
    const playIcon = paused ? "play" : "pause";

    this.pauseBtn.innerHTML = `<i class="fa-solid fa-${playIcon}"></i> ${p}`;
  }

  showFinalMessage() {
    this.finalMessageContainer.appendChild(
      elt(
        "div",
        { className: "final-message-container" },
        elt("p", { className: "message" }, "Game Over")
      )
    );
  }

  clearFinalMessage() {
    this.finalMessageContainer.textContent = "";
  }

  #init() {
    const state = this.state;
    const controller = this.controller;

    this.#drawBackground();

    if (snakeSprite.complete) {
      this.#drawSnake(state.snake);
    } else {
      snakeSprite.onload = () => this.#drawSnake(state.snake);
    }

    if (fruitsSprite.complete) {
      this.#drawFruit(state.fruit);
    } else {
      fruitsSprite.onload = () => this.#drawFruit(state.fruit);
    }

    this.syncMuted(state.isGameMuted);
    this.syncPaused(controller.isGamePaused);
    this.setBestScore(state.bestScore);
    this.setScore(state.score);
  }

  #getReferences() {
    this.scoreDOM = $("#current-score");
    this.bestScoreDOM = $("#best-score");
    this.muteButton = $("#mute-btn");
    this.pauseBtn = $("#pause-btn");
  }

  #registerEventHandlers() {
    const controller = this.controller;

    // for keyboard
    window.addEventListener("keydown", (e) => {
      if (e.key.indexOf("Arrow") !== -1) {
        e.preventDefault();
        controller.handleArrowPress(e);
      }

      const index = this.shortcuts.findIndex((s) => s.key === e.key);
      if (index !== -1) {
        e.preventDefault();
        this.shortcuts[index].func();
      }
    });

    // buttons
    $("#restart-btn").onclick = () => controller.restartGame();
    this.muteButton.onclick = () => controller.handleMuteGame();
    this.pauseBtn.onclick = () => controller.handlePauseGame();

    // virtual controls
    $$("#virtual-controls button").forEach((b) => {
      b.onclick = function (e) {
        controller.handleArrowPress({
          key: this.getAttribute("data-direction"),
        });
      };
    });
  }

  #createCanvas() {
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
  }

  #drawSnake(snake) {
    this.#drawSnakeHead(snake.head);
    this.#drawSnakeTail(snake.tail);
  }

  #drawBackground() {
    drawChessBackground(
      this.canvasContext,
      this.canvasWidth,
      this.canvasHeight,
      "#180",
      "#190",
      scale
    );
  }

  #drawFruit(fruit) {
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

  #drawSnakeHead(head) {
    const x = Math.floor(head.position.x) * scale,
      y = Math.floor(head.position.y) * scale;

    const centerX = x + 0.5 * scale,
      centerY = y + 0.5 * scale;

    this.canvasContext.save();
    rotateCanvasBasedOnDirection(
      this.canvasContext,
      head.direction,
      centerX,
      centerY
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

  #drawSnakeTail(tail) {
    if (tail.length === 0) return;

    for (let i = 0; i < tail.length - 1; i++) {
      const part = tail[i];

      // the centers are used to rotate the canvas correctly
      const x = Math.floor(part.position.x) * scale,
        y = Math.floor(part.position.y) * scale;
      const centerX = x + 0.5 * scale,
        centerY = y + 0.5 * scale;

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

const directions = ["down", "up", "left", "right"];

class Controller {
  #scheduledDirectionChanges = [];

  init(state, view) {
    this.state = state;
    this.view = view;

    this.isGamePaused = false;
    this.isGameRunning = false;
  }

  restartGame() {
    this.state = State.start(mapBoundaries, this.state.isGameMuted);
    this.view.clearFinalMessage();
    this.view.syncState(this.state);
    this.#scheduledDirectionChanges = [];
    this.isGameRunning = false;
    cancelAnimationFrame(currentAnimation);
  }

  handleMuteGame() {
    this.state.isGameMuted = !this.state.isGameMuted;
    const nextIsMuted = this.state.isGameMuted;

    this.view.syncMuted(nextIsMuted);

    if (nextIsMuted) {
      backgroundSong.pause();
    } else {
      backgroundSong.play();
    }
  }

  handleArrowPress(e) {
    if (!this.isGameRunning) {
      this.isGameRunning = true;
      this.view.syncPaused(false);
      runAnimation((timeStep) => this.runner(timeStep));
    }

    if (this.isGamePaused) return;

    const key = e.key;

    directions.forEach((d) => {
      const directionRegExp = new RegExp(d, "i");

      if (directionRegExp.test(key)) {
        this.scheduleDirectionChange(d);
      }
    });
  }

  scheduleDirectionChange(direction) {
    const axis = getAxis(direction);
    if (this.#scheduledDirectionChanges.every((d) => getAxis(d) !== axis)) {
      this.#scheduledDirectionChanges.push(direction);
    }
  }

  handlePauseGame() {
    if (!this.isGameRunning || this.state.status === "lost") return;

    this.isGamePaused = !this.isGamePaused;
    this.view.syncPaused(this.isGamePaused);
  }

  runner(timeStep) {
    if (this.isGamePaused) return true;

    this.state = this.state.update(timeStep, this.#scheduledDirectionChanges);

    if (this.state.status === "playing") {
      this.view.syncState(this.state);
      return true;
    } else {
      this.view.showFinalMessage(this.state.status);
      this.saveBestScore(this.state.score);
      return false;
    }
  }

  saveBestScore(newBestScore) {
    const savedBestScore = this.state.bestScore;

    if (savedBestScore < newBestScore) {
      localStorage.setItem("best-score", newBestScore);
      this.view.setBestScore(newBestScore);
    }
  }
}

const state = State.start(mapBoundaries, true);
const controller = new Controller();

const shortcuts = [
  { key: "p", func: () => controller.handlePauseGame() },
  { key: "m", func: () => controller.handleMuteGame() },
  { key: "r", func: () => controller.restartGame() },
];

const view = new View(state, controller, shortcuts);

controller.init(state, view);
